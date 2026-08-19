"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPlacementPreview } from "@/engine/solar/placement-preview";
import type { SolarPanelSpec } from "@/engine/solar/panel";
import type { PanelPlacement as EnginePlacement } from "@/engine/solar/placement";
import { calculateAnnualProduction } from "@/engine/solar/production/annual-production";
import { generateLayout, type GenerateLayoutResponse } from "@/features/auto-layout/api";
import { useDesignEditorStore } from "./editor-store";
import type { DesignTool, Point2D } from "./types";

const tools: { id: DesignTool; label: string; hint: string }[] = [
  { id: "select", label: "Select", hint: "V" },
  { id: "roof", label: "Roof", hint: "R" },
  { id: "panel", label: "Panel", hint: "P" },
  { id: "obstacle", label: "Obstacle", hint: "O" },
  { id: "measure", label: "Measure", hint: "M" },
];

const PANEL: SolarPanelSpec = { id: "default-400w", manufacturer: "Solar3D", model: "400W Reference", widthM: 1.134, lengthM: 1.722, powerWatts: 400, efficiency: 0.205 };
const SCALE = 55;
const ORIGIN = { x: 120, y: 70 };
const ROOF = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }, { x: 0, y: 6 }];
const SETBACK = { northM: 0.3, eastM: 0.3, southM: 0.3, westM: 0.3 };

function worldToSvg(point: Point2D) { return { x: ORIGIN.x + point.x * SCALE, y: ORIGIN.y + (6 - point.y) * SCALE }; }
function svgToWorld(clientX: number, clientY: number, rect: DOMRect): Point2D { return { x: (clientX - rect.left - ORIGIN.x) / SCALE, y: 6 - (clientY - rect.top - ORIGIN.y) / SCALE }; }
function toEngine(panel: { id: string; x: number; y: number; rotation: number }): EnginePlacement { return { id: panel.id, panelId: PANEL.id, center: { x: panel.x, y: panel.y }, rotation: panel.rotation as 0 | 90 | 180 | 270 }; }

function responseToPanels(response: GenerateLayoutResponse) {
  return response.placements.map((raw, index) => {
    const p = raw as Record<string, unknown>;
    const center = (p.center ?? {}) as Record<string, unknown>;
    const x = Number(p.x ?? center.x ?? 0);
    const y = Number(p.y ?? center.y ?? 0);
    const rotation = Number(p.rotation ?? 0);
    return { id: String(p.id ?? `auto-panel-${index + 1}`), x, y, rotation };
  });
}

interface DesignWorkspaceProps {
  projectId?: string;
  designVersionId?: string;
  roofId?: string;
  moduleId?: string;
}

export function DesignWorkspace({ projectId, designVersionId = "current", roofId = "roof-1", moduleId = PANEL.id }: DesignWorkspaceProps) {
  const { activeTool, setTool, zoom, setZoom, panels, selectedIds, addPanel, movePanel, rotatePanel, removePanel, select } = useDesignEditorStore();
  const stageRef = useRef<SVGSVGElement | null>(null);
  const [cursor, setCursor] = useState<Point2D | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [layoutBusy, setLayoutBusy] = useState(false);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [layoutResult, setLayoutResult] = useState<GenerateLayoutResponse | null>(null);
  const [setback, setSetback] = useState(0.3);
  const [rowSpacing, setRowSpacing] = useState(0.1);
  const [orientation, setOrientation] = useState<"auto" | "portrait" | "landscape">("auto");
  const enginePanels = useMemo(() => panels.map(toEngine), [panels]);
  const panelById = useCallback((id: string) => id === PANEL.id ? PANEL : undefined, []);
  const production = useMemo(() => calculateAnnualProduction({ panelCount: panels.length, panelPowerWatts: PANEL.powerWatts }), [panels.length]);

  const getPreview = useCallback((center: Point2D, rotation: 0 | 90 | 180 | 270, ignoreId?: string) => {
    const existing = enginePanels.filter((panel) => panel.id !== ignoreId);
    return createPlacementPreview(ROOF, PANEL, center, rotation, existing, panelById, SETBACK, 0.05, ignoreId ?? "preview");
  }, [enginePanels, panelById]);

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
      if (validation.valid) movePanel(draggingId, point.x, point.y);
    }
  }, [draggingId, getPreview, movePanel, panels, pointerToWorld]);

  const onStageClick = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool !== "panel" || !preview?.valid || draggingId) return;
    const placement = preview.placement;
    addPanel({ id: `panel-${Date.now()}`, x: placement.center.x, y: placement.center.y, rotation: placement.rotation });
  }, [activeTool, addPanel, draggingId, preview]);

  const runAutoLayout = useCallback(async () => {
    setLayoutBusy(true);
    setLayoutError(null);
    try {
      const response = await generateLayout({ designVersionId, roofId, moduleId, setbackM: setback, rowSpacingM: rowSpacing, orientation });
      setLayoutResult(response);
      const generated = responseToPanels(response);
      if (generated.length === 0) throw new Error("The layout engine returned no valid panel placements.");
      // Preview only: do not mutate the live editor until the user accepts the layout.
    } catch (error) {
      setLayoutError(error instanceof Error ? error.message : "Automatic layout failed.");
    } finally {
      setLayoutBusy(false);
    }
  }, [designVersionId, moduleId, orientation, roofId, rowSpacing, setback]);

  const acceptLayout = useCallback(() => {
    if (!layoutResult) return;
    const generated = responseToPanels(layoutResult);
    panels.forEach((panel) => removePanel(panel.id));
    generated.forEach((panel) => addPanel(panel));
    setLayoutOpen(false);
  }, [addPanel, layoutResult, panels, removePanel]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "p") setTool("panel");
      if (event.key.toLowerCase() === "v") setTool("select");
      if (event.key.toLowerCase() === "r" && selectedIds[0]) rotatePanel(selectedIds[0]);
      if (event.key === "Delete" && selectedIds[0]) removePanel(selectedIds[0]);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [removePanel, rotatePanel, selectedIds, setTool]);

  const roofPoints = ROOF.map(worldToSvg).map((p) => `${p.x},${p.y}`).join(" ");
  const selected = panels.find((panel) => panel.id === selectedIds[0]);
  const capacity = panels.length * PANEL.powerWatts / 1000;

  return (
    <div className="design-shell">
      <header className="design-header"><strong>Solar3D</strong><span> / Design</span><div className="design-actions"><button>Save</button><button className="primary" onClick={() => { setLayoutOpen(true); setLayoutResult(null); setLayoutError(null); }}>Generate Layout</button><button className="primary">Generate proposal</button></div></header>
      <div className="design-body">
        <aside className="design-toolbar"><span className="toolbar-title">TOOLS</span>{tools.map((tool) => <button key={tool.id} className={activeTool === tool.id ? "tool active" : "tool"} onClick={() => setTool(tool.id)}><span>{tool.label}</span><kbd>{tool.hint}</kbd></button>)}</aside>
        <section className="cad-stage" onPointerLeave={() => setCursor(null)}>
          <svg ref={stageRef} viewBox="0 0 800 500" width="100%" height="100%" role="application" aria-label="Solar design canvas" onPointerMove={onPointerMove} onClick={onStageClick}>
            <defs><pattern id="solar-grid" width="27.5" height="27.5" patternUnits="userSpaceOnUse"><path d="M 27.5 0 L 0 0 0 27.5" fill="none" stroke="currentColor" strokeOpacity="0.08" /></pattern></defs>
            <rect width="800" height="500" fill="url(#solar-grid)" />
            <polygon points={roofPoints} fill="currentColor" fillOpacity="0.04" stroke="currentColor" strokeWidth="2" />
            <text x={ORIGIN.x + 10} y={ORIGIN.y + 20} fontSize="13">Roof area · 60 m²</text>
            {panels.map((panel) => { const p = worldToSvg({ x: panel.x, y: panel.y }); const w = (panel.rotation % 180 === 0 ? PANEL.widthM : PANEL.lengthM) * SCALE; const h = (panel.rotation % 180 === 0 ? PANEL.lengthM : PANEL.widthM) * SCALE; return <g key={panel.id} transform={`translate(${p.x} ${p.y}) rotate(${-panel.rotation})`} onPointerDown={(event) => { event.stopPropagation(); select(panel.id); setDraggingId(panel.id); (event.currentTarget as SVGGElement).setPointerCapture(event.pointerId); }} onPointerUp={() => setDraggingId(null)} onDoubleClick={(event) => { event.stopPropagation(); rotatePanel(panel.id); }}><rect x={-w / 2} y={-h / 2} width={w} height={h} rx="2" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth={selectedIds.includes(panel.id) ? 3 : 1.5} /><path d={`M ${-w / 2} 0 H ${w / 2} M 0 ${-h / 2} V ${h / 2}`} stroke="currentColor" strokeOpacity="0.35" /></g>; })}
            {preview && cursor && <g pointerEvents="none" opacity="0.72"><rect x={worldToSvg(preview.placement.center).x - (PANEL.widthM * SCALE) / 2} y={worldToSvg(preview.placement.center).y - (PANEL.lengthM * SCALE) / 2} width={PANEL.widthM * SCALE} height={PANEL.lengthM * SCALE} fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" /></g>}
          </svg>
          <div className="stage-controls"><button onClick={() => setZoom(zoom - .25)}>−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(zoom + .25)}>+</button></div>
          {activeTool === "panel" && <div style={{ position: "absolute", left: 16, bottom: 16, fontSize: 12 }}>{preview?.valid ? "Valid placement · click to place" : "Invalid placement · move onto usable roof"}</div>}
        </section>
        <aside className="design-properties">
          <span className="toolbar-title">PROPERTIES</span>
          <h3>Design</h3>
          <div className="property"><span>Tool</span><strong>{activeTool}</strong></div>
          <div className="property"><span>Zoom</span><strong>{Math.round(zoom * 100)}%</strong></div>
          {selected && <><hr/><h3>Selected Panel</h3><div className="property"><span>Model</span><strong>{PANEL.model}</strong></div><div className="property"><span>Power</span><strong>{PANEL.powerWatts} W</strong></div><div className="property"><span>Rotation</span><strong>{selected.rotation}°</strong></div></>}
          <hr/>
          <h3>System</h3>
          <div className="metric"><strong>{panels.length}</strong><span>Panels</span></div>
          <div className="metric"><strong>{capacity.toFixed(1)} kWp</strong><span>Capacity</span></div>
          <div className="metric"><strong>60 m²</strong><span>Roof area</span></div>
          <section aria-labelledby="production-heading" style={{ marginTop: 18, padding: 14, border: "1px solid currentColor", borderRadius: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <h3 id="production-heading" style={{ margin: 0 }}>Production</h3>
              <span style={{ fontSize: 11, padding: "3px 7px", borderRadius: 999, background: "rgba(180,120,0,.14)" }}>Reference</span>
            </div>
            <div style={{ marginTop: 10, fontSize: 26, fontWeight: 700 }}>{production.annualKwh.toFixed(0)} <span style={{ fontSize: 13, fontWeight: 500 }}>kWh/year</span></div>
            <div style={{ marginTop: 8, fontSize: 12, opacity: .72 }}>Based on {production.dcCapacityKwp.toFixed(1)} kWp DC, {Math.round(production.performanceRatio * 100)}% PR and {production.specificYieldKwhPerKwp.toLocaleString()} kWh/kWp reference yield.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
              <div><strong>{production.shadingLossPct.toFixed(0)}%</strong><small style={{ display: "block", opacity: .6 }}>Shading loss</small></div>
              <div><strong>12 months</strong><small style={{ display: "block", opacity: .6 }}>Monthly profile</small></div>
            </div>
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer", fontSize: 12 }}>Monthly production</summary>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 10, fontSize: 11 }}>
                {production.monthlyKwh.map((value, index) => <div key={index}><strong>{value.toFixed(0)}</strong><span style={{ display: "block", opacity: .55 }}>{["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][index]}</span></div>)}
              </div>
            </details>
            {production.warnings.length > 0 && <div role="note" style={{ marginTop: 12, padding: 10, borderRadius: 9, background: "rgba(180,120,0,.10)", fontSize: 11 }}><strong>Estimate limitation</strong><ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{production.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
          </section>
        </aside>
      </div>
      {layoutOpen && <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.42)", display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ width: "min(520px, 100%)", background: "var(--panel, #fff)", borderRadius: 16, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}><div><h2 style={{ margin: 0 }}>Generate Layout</h2><p style={{ margin: "6px 0 0", opacity: .65 }}>Create a preview without replacing your manual design.</p></div><button onClick={() => setLayoutOpen(false)}>×</button></div>
          <div style={{ display: "grid", gap: 14, marginTop: 22 }}>
            <label>Edge setback · {setback.toFixed(2)} m<input type="range" min="0" max="2" step="0.05" value={setback} onChange={(e) => setSetback(Number(e.target.value))} style={{ width: "100%" }} /></label>
            <label>Row spacing · {rowSpacing.toFixed(2)} m<input type="range" min="0" max="1" step="0.05" value={rowSpacing} onChange={(e) => setRowSpacing(Number(e.target.value))} style={{ width: "100%" }} /></label>
            <label>Orientation<select value={orientation} onChange={(e) => setOrientation(e.target.value as typeof orientation)} style={{ display: "block", width: "100%", padding: 9, marginTop: 5 }}><option value="auto">Auto</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
          </div>
          {layoutError && <div role="alert" style={{ marginTop: 16, padding: 12, borderRadius: 10, background: "rgba(200,40,40,.1)" }}>{layoutError}</div>}
          {layoutResult && <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 18 }}><div><strong>{layoutResult.panelCount}</strong><small style={{ display: "block", opacity: .6 }}>Panels</small></div><div><strong>{layoutResult.dcCapacityKw.toFixed(1)} kW</strong><small style={{ display: "block", opacity: .6 }}>DC capacity</small></div><div><strong>{layoutResult.roofCoveragePercent.toFixed(0)}%</strong><small style={{ display: "block", opacity: .6 }}>Coverage</small></div></div>}
          {layoutResult?.warnings?.length ? <ul style={{ marginTop: 14, paddingLeft: 20 }}>{layoutResult.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}><button onClick={() => setLayoutOpen(false)}>Cancel</button>{layoutResult && <button className="primary" onClick={acceptLayout}>Accept layout</button>}<button className="primary" onClick={runAutoLayout} disabled={layoutBusy}>{layoutBusy ? "Generating…" : layoutResult ? "Regenerate" : "Generate"}</button></div>
          {!projectId && <p style={{ marginBottom: 0, marginTop: 14, fontSize: 12, opacity: .6 }}>Project context is unavailable; configure the design identifiers before enabling production generation.</p>}
        </div>
      </div>}
      <footer className="design-footer"><span>{activeTool === "panel" ? (preview?.valid ? "Ready to place" : "Invalid placement") : "Ready"}</span><span>Grid · 0.5 m</span><span>Coordinates · {cursor ? `${cursor.x.toFixed(2)}, ${cursor.y.toFixed(2)}` : "0, 0"}</span></footer>
    </div>
  );
}
