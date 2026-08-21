"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPlacementPreview } from "@/engine/solar/placement-preview";
import type { SolarPanelSpec } from "@/engine/solar/panel";
import type { PanelPlacement as EnginePlacement } from "@/engine/solar/placement";
import { calculateAnnualProduction } from "@/engine/solar/production/annual-production";
import { createDesignPersistence } from "@/shared/api/design-persistence";
import { invokeFunction } from "@/shared/api/client";
import { mapDesignContext, type DesignContext, type DesignContextApiResponse } from "@/shared/api/design-context";
import { useDesignEditorStore } from "./editor-store";
import { FinancialSummary } from "./FinancialSummary";
import { ProductionDashboard } from "./ProductionDashboard";
import type { DesignTool, Point2D } from "./types";

const tools: { id: DesignTool; label: string; hint: string }[] = [
  { id: "select", label: "Select", hint: "V" },
  { id: "roof", label: "Roof", hint: "R" },
  { id: "panel", label: "Panel", hint: "P" },
  { id: "obstacle", label: "Obstacle", hint: "O" },
  { id: "measure", label: "Measure", hint: "M" },
];

const SCALE = 55;
const ORIGIN = { x: 120, y: 70 };

function worldToSvg(point: Point2D, maxY: number) {
  return { x: ORIGIN.x + point.x * SCALE, y: ORIGIN.y + (maxY - point.y) * SCALE };
}

function svgToWorld(clientX: number, clientY: number, rect: DOMRect, maxY: number): Point2D {
  return { x: (clientX - rect.left - ORIGIN.x) / SCALE, y: maxY - (clientY - rect.top - ORIGIN.y) / SCALE };
}

function toEngine(panel: { id: string; x: number; y: number; rotation: number }, moduleId: string): EnginePlacement {
  return { id: panel.id, panelId: moduleId, center: { x: panel.x, y: panel.y }, rotation: panel.rotation as 0 | 90 | 180 | 270 };
}

export function DesignWorkspace({ projectId }: { projectId: string }) {
  const { activeTool, setTool, zoom, setZoom, roofs, panels, selectedIds, addPanel, movePanel, rotatePanel, removePanel, select, hydrate } = useDesignEditorStore();
  const stageRef = useRef<SVGSVGElement | null>(null);
  const [cursor, setCursor] = useState<Point2D | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [context, setContext] = useState<DesignContext | null>(null);
  const [persistedMetrics, setPersistedMetrics] = useState<Record<string, unknown> | undefined>();
  const [saveState, setSaveState] = useState<"loading" | "ready" | "saving" | "saved" | "error">("loading");
  const [saveError, setSaveError] = useState<string | null>(null);
  const persistence = useMemo(() => createDesignPersistence({ invoke: (action, body) => invokeFunction("solar-project-api", { action, ...body }) }), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setSaveState("loading");
        const response = await invokeFunction<DesignContextApiResponse>("solar-project-api", { action: "get_design_context", project_id: projectId });
        const nextContext = mapDesignContext(response);
        if (cancelled) return;
        setContext(nextContext);
        hydrate({ id: nextContext.roofId ?? "roof-1", points: nextContext.roof }, []);

        if (nextContext.designVersionId) {
          const snapshot = await persistence.load(nextContext.designId);
          if (!cancelled && snapshot) {
            hydrate({ id: snapshot.roofId ?? nextContext.roofId ?? "roof-1", points: snapshot.roof.length ? snapshot.roof : nextContext.roof }, snapshot.panelPlacements.map((p) => ({ id: p.id, x: p.center.x, y: p.center.y, rotation: Number(p.rotation) })));
            setPersistedMetrics(snapshot.metrics);
          }
        }
        setSaveState("ready");
      } catch (error) {
        if (!cancelled) {
          setSaveError(error instanceof Error ? error.message : "Unable to load project design context");
          setSaveState("error");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [hydrate, persistence, projectId]);

  const module = context?.module;
  const roof = roofs[0]?.points?.length ? roofs[0].points : context?.roof ?? [];
  const maxY = Math.max(1, ...roof.map((point) => point.y));
  const enginePanels = useMemo(() => module ? panels.map((panel) => toEngine(panel, module.id)) : [], [module, panels]);
  const panelById = useCallback((id: string) => id === module?.id && module ? ({
    id: module.id,
    manufacturer: module.manufacturer,
    model: module.model,
    widthM: module.widthM,
    lengthM: module.lengthM,
    powerWatts: module.powerWatts,
    efficiency: module.efficiency,
  } satisfies SolarPanelSpec) : undefined, [module]);
  const production = useMemo(() => calculateAnnualProduction({ panelCount: panels.length, panelPowerWatts: module?.powerWatts ?? 0 }), [module?.powerWatts, panels.length]);

  const getPreview = useCallback((center: Point2D, rotation: 0 | 90 | 180 | 270, ignoreId?: string) => {
    if (!module || roof.length < 3) return null;
    const panel: SolarPanelSpec = { id: module.id, manufacturer: module.manufacturer, model: module.model, widthM: module.widthM, lengthM: module.lengthM, powerWatts: module.powerWatts, efficiency: module.efficiency };
    const existing = enginePanels.filter((item) => item.id !== ignoreId);
    return createPlacementPreview(roof, panel, center, rotation, existing, panelById, context?.setback ?? { northM: 0, eastM: 0, southM: 0, westM: 0 }, 0.05, ignoreId ?? "preview");
  }, [context?.setback, enginePanels, module, panelById, roof]);

  const preview = useMemo(() => cursor && activeTool === "panel" ? getPreview(cursor, 0) : null, [activeTool, cursor, getPreview]);

  const pointerToWorld = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const rect = stageRef.current?.getBoundingClientRect();
    return rect ? svgToWorld(event.clientX, event.clientY, rect, maxY) : null;
  }, [maxY]);

  const onPointerMove = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const point = pointerToWorld(event);
    if (!point) return;
    setCursor(point);
    if (draggingId) {
      const current = panels.find((panel) => panel.id === draggingId);
      if (!current) return;
      const validation = getPreview(point, current.rotation as 0 | 90 | 180 | 270, draggingId);
      if (validation?.valid) movePanel(draggingId, point.x, point.y);
    }
  }, [draggingId, getPreview, movePanel, panels, pointerToWorld]);

  const onStageClick = useCallback(() => {
    if (!module || activeTool !== "panel" || !preview?.valid || draggingId) return;
    const placement = preview.placement;
    addPanel({ id: `panel-${Date.now()}`, x: placement.center.x, y: placement.center.y, rotation: placement.rotation });
  }, [activeTool, addPanel, draggingId, module, preview]);

  const save = useCallback(async () => {
    if (!context || !module) return;
    try {
      setSaveState("saving");
      setSaveError(null);
      const snapshot = await persistence.save({
        designId: context.designId,
        roof,
        roofId: context.roofId,
        roofAreaM2: context.roofAreaM2,
        moduleId: module.id,
        setbackM: Math.max(context.setback.northM, context.setback.eastM, context.setback.southM, context.setback.westM),
        panelPlacements: panels.map((panel) => toEngine(panel, module.id)),
        metrics: {
          panel_count: panels.length,
          dc_capacity_kw: production.dcCapacityKwp,
          annual_kwh: production.annualKwh,
          monthly_kwh: production.monthlyKwh,
          shading_loss_pct: production.shadingLossPct,
          performance_ratio: production.performanceRatio,
          specific_yield_kwh_per_kwp: production.specificYieldKwhPerKwp,
          warnings: production.warnings,
          financial: persistedMetrics?.financial,
        },
      });
      setPersistedMetrics(snapshot.metrics);
      setSaveState("saved");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save design");
      setSaveState("error");
    }
  }, [context, module, panels, persistence, persistedMetrics?.financial, production, roof]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "p") setTool("panel");
      if (event.key.toLowerCase() === "v") setTool("select");
      if (event.key.toLowerCase() === "r" && selectedIds[0]) rotatePanel(selectedIds[0]);
      if (event.key === "Delete" && selectedIds[0]) removePanel(selectedIds[0]);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void save(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [removePanel, rotatePanel, save, selectedIds, setTool]);

  if (saveState === "loading") return <div className="design-shell"><div className="emptyState">Loading project design context…</div></div>;
  if (saveState === "error" && !context) return <div className="design-shell"><div className="emptyState"><strong>Project design unavailable</strong><span>{saveError ?? "Unable to load canonical project data."}</span></div></div>;
  if (!context || !module) return <div className="design-shell"><div className="emptyState"><strong>Design context unavailable</strong><span>Canonical project geometry and module data are required.</span></div></div>;

  const roofPoints = roof.map((point) => worldToSvg(point, maxY)).map((point) => `${point.x},${point.y}`).join(" ");
  const selected = panels.find((panel) => panel.id === selectedIds[0]);
  const capacity = production.dcCapacityKwp;
  const roofAreaM2 = context.roofAreaM2;
  const financialMetrics = (persistedMetrics?.financial ?? undefined) as Record<string, unknown> | undefined;
  const stateSignature = JSON.stringify({ designId: context.designId, roof, panels, module, production, financial: financialMetrics });

  return (
    <div className="design-shell" data-testid="solar-design-state" data-state={stateSignature} data-project-id={projectId} data-roof-id={context.roofId ?? ""} data-module-id={module.id}>
      <header className="design-header"><strong>Solar3D</strong><span> / Design</span><div className="design-actions"><button onClick={() => void save()} disabled={saveState === "saving"}>{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Save"}</button><button className="primary">Generate proposal</button></div></header>
      <div className="design-body">
        <aside className="design-toolbar"><span className="toolbar-title">TOOLS</span>{tools.map((tool) => <button key={tool.id} className={activeTool === tool.id ? "tool active" : "tool"} onClick={() => setTool(tool.id)}><span>{tool.label}</span><kbd>{tool.hint}</kbd></button>)}</aside>
        <section className="cad-stage" onPointerLeave={() => setCursor(null)}>
          <svg ref={stageRef} viewBox="0 0 800 500" width="100%" height="100%" role="application" aria-label="Solar design canvas" onPointerMove={onPointerMove} onClick={onStageClick}>
            <defs><pattern id="solar-grid" width="27.5" height="27.5" patternUnits="userSpaceOnUse"><path d="M 27.5 0 L 0 0 0 27.5" fill="none" stroke="currentColor" strokeOpacity="0.08" /></pattern></defs>
            <rect width="800" height="500" fill="url(#solar-grid)" />
            <polygon points={roofPoints} fill="currentColor" fillOpacity="0.04" stroke="currentColor" strokeWidth="2" />
            <text x={ORIGIN.x + 10} y={ORIGIN.y + 20} fontSize="13">Roof area · {roofAreaM2 == null ? "—" : `${roofAreaM2.toFixed(0)} m²`}</text>
            {panels.map((panel) => { const p = worldToSvg({ x: panel.x, y: panel.y }, maxY); const w = (panel.rotation % 180 === 0 ? module.widthM : module.lengthM) * SCALE; const h = (panel.rotation % 180 === 0 ? module.lengthM : module.widthM) * SCALE; return <g key={panel.id} transform={`translate(${p.x} ${p.y}) rotate(${-panel.rotation})`} onPointerDown={(event) => { event.stopPropagation(); select(panel.id); setDraggingId(panel.id); (event.currentTarget as SVGGElement).setPointerCapture(event.pointerId); }} onPointerUp={() => setDraggingId(null)} onDoubleClick={(event) => { event.stopPropagation(); rotatePanel(panel.id); }}><rect x={-w / 2} y={-h / 2} width={w} height={h} rx="2" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth={selectedIds.includes(panel.id) ? 3 : 1.5} /><path d={`M ${-w / 2} 0 H ${w / 2} M 0 ${-h / 2} V ${h / 2}`} stroke="currentColor" strokeOpacity="0.35" /></g>; })}
            {preview && cursor && <g pointerEvents="none" opacity="0.72"><rect x={worldToSvg(preview.placement.center, maxY).x - (module.widthM * SCALE) / 2} y={worldToSvg(preview.placement.center, maxY).y - (module.lengthM * SCALE) / 2} width={module.widthM * SCALE} height={module.lengthM * SCALE} fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" /></g>}
          </svg>
          <div className="stage-controls"><button onClick={() => setZoom(zoom - .25)}>−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(zoom + .25)}>+</button></div>
          {activeTool === "panel" && <div style={{ position: "absolute", left: 16, bottom: 16, fontSize: 12 }}>{preview?.valid ? "Valid placement · click to place" : "Invalid placement · move onto usable roof"}</div>}
        </section>
        <aside className="design-properties">
          <span className="toolbar-title">PROPERTIES</span>
          <h3>Design</h3>
          <div className="property"><span>Project</span><strong>{projectId}</strong></div>
          <div className="property"><span>Tool</span><strong>{activeTool}</strong></div>
          <div className="property"><span>Zoom</span><strong>{Math.round(zoom * 100)}%</strong></div>
          {selected && <><hr/><h3>Selected Panel</h3><div className="property"><span>Model</span><strong>{module.model}</strong></div><div className="property"><span>Power</span><strong>{module.powerWatts} W</strong></div><div className="property"><span>Rotation</span><strong>{selected.rotation}°</strong></div></>}
          <hr/>
          <ProductionDashboard metrics={{ panelCount: panels.length, dcCapacityKw: capacity, roofAreaM2, annualKwh: production.annualKwh, shadingLossPct: production.shadingLossPct }} />
          <hr/>
          <FinancialSummary metrics={financialMetrics} />
          {production.warnings.length > 0 && <div role="note" style={{ marginTop: 12, fontSize: 12 }}>{production.warnings.map((warning) => <div key={warning}>{warning}</div>)}</div>}
          {saveError && <div style={{ marginTop: 12, fontSize: 12 }}>{saveError}</div>}
        </aside>
      </div>
      <footer className="design-footer"><span>{saveState === "saving" ? "Saving…" : saveState === "error" ? "Persistence error" : activeTool === "panel" ? (preview?.valid ? "Ready to place" : "Invalid placement") : "Ready"}</span><span>Grid · 0.5 m</span><span>Coordinates · {cursor ? `${cursor.x.toFixed(2)}, ${cursor.y.toFixed(2)}` : "0, 0"}</span></footer>
    </div>
  );
}
