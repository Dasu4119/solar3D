"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPlacementPreview } from "@/engine/solar/placement-preview";
import type { SolarPanelSpec } from "@/src/engine/solar/panel";
import type { PanelPlacement as EnginePlacement } from "@/engine/solar/placement";
import { calculateAnnualProduction } from "@/engine/solar/production/annual-production";
import { createDesignPersistence } from "@/shared/api/design-persistence";
import { loadDesignContext } from "@/shared/api/design-context";
import { invokeFunction } from "@/shared/api/client";
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
const CANVAS_WORLD_HEIGHT_M = 6;

function worldToSvg(point: Point2D) { return { x: ORIGIN.x + point.x * SCALE, y: ORIGIN.y + (CANVAS_WORLD_HEIGHT_M - point.y) * SCALE }; }
function svgToWorld(clientX: number, clientY: number, rect: DOMRect): Point2D { return { x: (clientX - rect.left - ORIGIN.x) / SCALE, y: CANVAS_WORLD_HEIGHT_M - (clientY - rect.top - ORIGIN.y) / SCALE }; }
function toEngine(panel: { id: string; x: number; y: number; rotation: number }, panelSpec: SolarPanelSpec): EnginePlacement { return { id: panel.id, panelId: panelSpec.id, center: { x: panel.x, y: panel.y }, rotation: panel.rotation as 0 | 90 | 180 | 270 }; }

interface DesignLookup { success?: boolean; design?: { id: string } | null; error?: string }

export function DesignWorkspace({ projectId }: { projectId: string }) {
  const { activeTool, setTool, zoom, setZoom, roofs, panels, selectedIds, addPanel, movePanel, rotatePanel, removePanel, select, hydrate } = useDesignEditorStore();
  const stageRef = useRef<SVGSVGElement | null>(null);
  const [cursor, setCursor] = useState<Point2D | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [designId, setDesignId] = useState<string | null>(null);
  const [persistedMetrics, setPersistedMetrics] = useState<Record<string, unknown> | undefined>();
  const [designContext, setDesignContext] = useState<{ module: SolarPanelSpec; defaults: { roof: Point2D[]; setback: { northM: number; eastM: number; southM: number; westM: number } } } | null>(null);
  const [saveState, setSaveState] = useState<"loading" | "ready" | "saving" | "saved" | "error">("loading");
  const [saveError, setSaveError] = useState<string | null>(null);
  const panelSpec = designContext?.module;
  const enginePanels = useMemo(() => panelSpec ? panels.map((panel) => toEngine(panel, panelSpec)) : [], [panels, panelSpec]);
  const panelById = useCallback((id: string) => id === panelSpec?.id ? panelSpec : undefined, [panelSpec]);
  const roof = roofs[0]?.points?.length ? roofs[0].points : designContext?.defaults.roof ?? [];
  const setback = designContext?.defaults.setback;
  const persistence = useMemo(() => createDesignPersistence({ invoke: (action, body) => invokeFunction("solar-project-api", { action, ...body }) }), []);
  const production = useMemo(() => calculateAnnualProduction({ panelCount: panels.length, panelPowerWatts: panelSpec?.powerWatts ?? 0 }), [panels.length, panelSpec?.powerWatts]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setSaveState("loading");
        const [context, lookup] = await Promise.all([
          loadDesignContext((action, body) => invokeFunction("solar-project-api", { action, ...body })),
          invokeFunction<DesignLookup>("solar-project-api", { action: "get_design_for_project", project_id: projectId }),
        ]);
        if (!lookup.success || !lookup.design?.id) throw new Error(lookup.error ?? "No design found for project");
        const snapshot = await persistence.load(lookup.design.id);
        if (cancelled) return;
        setDesignContext(context);
        if (snapshot) {
          const loadedRoof = snapshot.roof.length ? { id: "roof-1", points: snapshot.roof } : null;
          const loadedPanels = snapshot.panelPlacements.map((p) => ({ id: p.id, x: p.center.x, y: p.center.y, rotation: Number(p.rotation) }));
          hydrate(loadedRoof, loadedPanels);
          setPersistedMetrics(snapshot.metrics);
        }
        setDesignId(lookup.design.id);
        setSaveState("ready");
      } catch (error) {
        if (!cancelled) { setSaveError(error instanceof Error ? error.message : "Unable to load design configuration"); setSaveState("error"); }
      }
    })();
    return () => { cancelled = true; };
  }, [hydrate, persistence, projectId]);

  const getPreview = useCallback((center: Point2D, rotation: 0 | 90 | 180 | 270, ignoreId?: string) => {
    if (!panelSpec || !setback) return null;
    const existing = enginePanels.filter((panel) => panel.id !== ignoreId);
    return createPlacementPreview(roof, panelSpec, center, rotation, existing, panelById, setback, 0.05, ignoreId ?? "preview");
  }, [enginePanels, panelById, panelSpec, roof, setback]);

  const preview = useMemo(() => cursor && activeTool === "panel" ? getPreview(cursor, 0) : null, [activeTool, cursor, getPreview]);

  const pointerToWorld = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const rect = stageRef.current?.getBoundingClientRect();
    return rect ? svgToWorld(event.clientX, event.clientY, rect) : null;
  }, []);

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

  const onStageClick = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool !== "panel" || !preview?.valid || draggingId || !panelSpec) return;
    const placement = preview.placement;
    addPanel({ id: `panel-${Date.now()}`, x: placement.center.x, y: placement.center.y, rotation: placement.rotation });
  }, [activeTool, addPanel, draggingId, panelSpec, preview]);

  const save = useCallback(async () => {
    if (!designId || !panelSpec) return;
    try {
      setSaveState("saving");
      setSaveError(null);
      const snapshot = await persistence.save({
        designId,
        roof,
        panelPlacements: panels.map((panel) => toEngine(panel, panelSpec)),
        metrics: {
          panel_count: panels.length,
          module_id: panelSpec.id,
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
      setDesignId(snapshot.designId);
      setPersistedMetrics(snapshot.metrics);
      setSaveState("saved");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save design");
      setSaveState("error");
    }
  }, [designId, panelSpec, panels, persistedMetrics?.financial, persistence, production, roof]);

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

  const roofPoints = roof.map(worldToSvg).map((p) => `${p.x},${p.y}`).join(" ");
  const selected = panels.find((panel) => panel.id === selectedIds[0]);
  const capacity = production.dcCapacityKwp;
  const roofAreaM2 = roof.length >= 3 ? Math.abs(roof.reduce((area, point, index) => { const next = roof[(index + 1) % roof.length]; return area + point.x * next.y - next.x * point.y; }, 0)) / 2 : 0;
  const usableRoofAreaM2 = Math.max(0, roofAreaM2 - (setback ? (setback.northM + setback.southM) * 10 + (setback.eastM + setback.westM) * 6 : 0));
  const financialMetrics = (persistedMetrics?.financial ?? undefined) as Record<string, unknown> | undefined;
  const stateSignature = JSON.stringify({ roof, panels, production, module: panelSpec, financial: financialMetrics });

  return (
    <div className="design-shell" data-testid="solar-design-state" data-state={stateSignature}>
      <header className="design-header"><strong>Solar3D</strong><span> / Design</span><div className="design-actions"><button onClick={() => void save()} disabled={!designId || !panelSpec || saveState === "saving"}>{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Save"}</button><button className="primary">Generate proposal</button></div></header>
      <div className="design-body">
        <aside className="design-toolbar"><span className="toolbar-title">TOOLS</span>{tools.map((tool) => <button key={tool.id} className={activeTool === tool.id ? "tool active" : "tool"} onClick={() => setTool(tool.id)}><span>{tool.label}</span><kbd>{tool.hint}</kbd></button>)}</aside>
        <section className="cad-stage" onPointerLeave={() => setCursor(null)}>
          <svg ref={stageRef} viewBox="0 0 800 500" width="100%" height="100%" role="application" aria-label="Solar design canvas" onPointerMove={onPointerMove} onClick={onStageClick}>
            <defs><pattern id="solar-grid" width="27.5" height="27.5" patternUnits="userSpaceOnUse"><path d="M 27.5 0 L 0 0 0 27.5" fill="none" stroke="currentColor" strokeOpacity="0.08" /></pattern></defs>
            <rect width="800" height="500" fill="url(#solar-grid)" />
            <polygon points={roofPoints} fill="currentColor" fillOpacity="0.04" stroke="currentColor" strokeWidth="2" />
            <text x={ORIGIN.x + 10} y={ORIGIN.y + 20} fontSize="13">Roof area · {roofAreaM2.toFixed(0)} m²</text>
            {panels.map((panel) => { if (!panelSpec) return null; const p = worldToSvg({ x: panel.x, y: panel.y }); const w = (panel.rotation % 180 === 0 ? panelSpec.widthM : panelSpec.lengthM) * SCALE; const h = (panel.rotation % 180 === 0 ? panelSpec.lengthM : panelSpec.widthM) * SCALE; return <g key={panel.id} transform={`translate(${p.x} ${p.y}) rotate(${-panel.rotation})`} onPointerDown={(event) => { event.stopPropagation(); select(panel.id); setDraggingId(panel.id); (event.currentTarget as SVGGElement).setPointerCapture(event.pointerId); }} onPointerUp={() => setDraggingId(null)} onDoubleClick={(event) => { event.stopPropagation(); rotatePanel(panel.id); }}><rect x={-w / 2} y={-h / 2} width={w} height={h} rx="2" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth={selectedIds.includes(panel.id) ? 3 : 1.5} /><path d={`M ${-w / 2} 0 H ${w / 2} M 0 ${-h / 2} V ${h / 2}`} stroke="currentColor" strokeOpacity="0.35" /></g>; })}
            {preview && cursor && panelSpec && <g pointerEvents="none" opacity="0.72"><rect x={worldToSvg(preview.placement.center).x - (panelSpec.widthM * SCALE) / 2} y={worldToSvg(preview.placement.center).y - (panelSpec.lengthM * SCALE) / 2} width={panelSpec.widthM * SCALE} height={panelSpec.lengthM * SCALE} fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" /></g>}
          </svg>
          <div className="stage-controls"><button onClick={() => setZoom(zoom - .25)}>−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(zoom + .25)}>+</button></div>
          {activeTool === "panel" && <div style={{ position: "absolute", left: 16, bottom: 16, fontSize: 12 }}>{preview?.valid ? "Valid placement · click to place" : "Invalid placement · move onto usable roof"}</div>}
        </section>
        <aside className="design-properties">
          <span className="toolbar-title">PROPERTIES</span>
          <h3>Design</h3>
          <div className="property"><span>Tool</span><strong>{activeTool}</strong></div>
          <div className="property"><span>Zoom</span><strong>{Math.round(zoom * 100)}%</strong></div>
          {selected && panelSpec && <><hr/><h3>Selected Panel</h3><div className="property"><span>Model</span><strong>{panelSpec.model}</strong></div><div className="property"><span>Power</span><strong>{panelSpec.powerWatts} W</strong></div><div className="property"><span>Rotation</span><strong>{selected.rotation}°</strong></div></>}
          <hr/>
          <ProductionDashboard metrics={{ panelCount: panels.length, dcCapacityKw: capacity, roofAreaM2, usableRoofAreaM2, annualKwh: production.annualKwh, shadingLossPct: production.shadingLossPct }} />
          <hr/>
          <FinancialSummary metrics={financialMetrics} />
          {production.warnings.length > 0 && <div role="note" style={{ marginTop: 12, fontSize: 12 }}>{production.warnings.map((warning) => <div key={warning}>{warning}</div>)}</div>}
          {saveError && <div style={{ marginTop: 12, fontSize: 12 }}>{saveError}</div>}
        </aside>
      </div>
      <footer className="design-footer"><span>{saveState === "loading" ? "Loading design…" : saveState === "saving" ? "Saving…" : saveState === "error" ? "Persistence error" : activeTool === "panel" ? (preview?.valid ? "Ready to place" : "Invalid placement") : "Ready"}</span><span>Grid · 0.5 m</span><span>Coordinates · {cursor ? `${cursor.x.toFixed(2)}, ${cursor.y.toFixed(2)}` : "0, 0"}</span></footer>
    </div>
  );
}
