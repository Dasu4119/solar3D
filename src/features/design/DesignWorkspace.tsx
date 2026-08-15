"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPlacementPreview } from "@/engine/solar/placement-preview";
import type { SolarPanelSpec } from "@/engine/solar/panel";
import type { PanelPlacement as EnginePlacement } from "@/engine/solar/placement";
import { useDesignEditorStore } from "./editor-store";
import type { DesignTool, Point2D } from "./types";

const tools: { id: DesignTool; label: string; hint: string }[] = [
  { id: "select", label: "Select", hint: "V" },
  { id: "roof", label: "Roof", hint: "R" },
  { id: "panel", label: "Panel", hint: "P" },
  { id: "obstacle", label: "Obstacle", hint: "O" },
  { id: "measure", label: "Measure", hint: "M" },
];

const PANEL: SolarPanelSpec = {
  id: "default-400w",
  manufacturer: "Solar3D",
  model: "400W Reference",
  widthM: 1.134,
  lengthM: 1.722,
  powerWatts: 400,
  efficiency: 0.205,
};

const SCALE = 55;
const ORIGIN = { x: 120, y: 70 };
const ROOF = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }, { x: 0, y: 6 }];
const SETBACK = { northM: 0.3, eastM: 0.3, southM: 0.3, westM: 0.3 };

function worldToSvg(point: Point2D) {
  return { x: ORIGIN.x + point.x * SCALE, y: ORIGIN.y + (6 - point.y) * SCALE };
}

function svgToWorld(clientX: number, clientY: number, rect: DOMRect): Point2D {
  return { x: (clientX - rect.left - ORIGIN.x) / SCALE, y: 6 - (clientY - rect.top - ORIGIN.y) / SCALE };
}

function toEngine(panel: { id: string; x: number; y: number; rotation: number }): EnginePlacement {
  return { id: panel.id, panelId: PANEL.id, center: { x: panel.x, y: panel.y }, rotation: panel.rotation as 0 | 90 | 180 | 270 };
}

export function DesignWorkspace() {
  const { activeTool, setTool, zoom, setZoom, panels, selectedIds, addPanel, movePanel, rotatePanel, removePanel, select } = useDesignEditorStore();
  const stageRef = useRef<SVGSVGElement | null>(null);
  const [cursor, setCursor] = useState<Point2D | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const enginePanels = useMemo(() => panels.map(toEngine), [panels]);
  const panelById = useCallback((id: string) => id === PANEL.id ? PANEL : undefined, []);
  const preview = useMemo(() => {
    if (!cursor || activeTool !== "panel") return null;
    return createPlacementPreview(ROOF, PANEL, cursor, 0, enginePanels, panelById, SETBACK, 0.05);
  }, [activeTool, cursor, enginePanels, panelById]);

  const pointerToWorld = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const rect = stageRef.current?.getBoundingClientRect();
    return rect ? svgToWorld(event.clientX, event.clientY, rect) : null;
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const point = pointerToWorld(event);
    if (!point) return;
    setCursor(point);
    if (draggingId) movePanel(draggingId, point.x, point.y);
  }, [draggingId, movePanel, pointerToWorld]);

  const onStageClick = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool !== "panel" || !preview?.valid || draggingId) return;
    const placement = preview.placement;
    addPanel({ id: `panel-${Date.now()}`, x: placement.center.x, y: placement.center.y, rotation: placement.rotation });
  }, [activeTool, addPanel, draggingId, preview]);

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
      <header className="design-header"><strong>Solar3D</strong><span> / Design</span><div className="design-actions"><button>Save</button><button className="primary">Generate proposal</button></div></header>
      <div className="design-body">
        <aside className="design-toolbar"><span className="toolbar-title">TOOLS</span>{tools.map((tool) => <button key={tool.id} className={activeTool === tool.id ? "tool active" : "tool"} onClick={() => setTool(tool.id)}><span>{tool.label}</span><kbd>{tool.hint}</kbd></button>)}</aside>
        <section className="cad-stage" onPointerLeave={() => setCursor(null)}>
          <svg ref={stageRef} viewBox="0 0 800 500" width="100%" height="100%" role="application" aria-label="Solar design canvas" onPointerMove={onPointerMove} onClick={onStageClick}>
            <defs><pattern id="solar-grid" width="27.5" height="27.5" patternUnits="userSpaceOnUse"><path d="M 27.5 0 L 0 0 0 27.5" fill="none" stroke="currentColor" strokeOpacity="0.08" /></pattern></defs>
            <rect width="800" height="500" fill="url(#solar-grid)" />
            <polygon points={roofPoints} fill="currentColor" fillOpacity="0.04" stroke="currentColor" strokeWidth="2" />
            <text x={ORIGIN.x + 10} y={ORIGIN.y + 20} fontSize="13">Roof area · 60 m²</text>
            {panels.map((panel) => { const p = worldToSvg({ x: panel.x, y: panel.y }); const w = PANEL.widthM * SCALE; const h = PANEL.lengthM * SCALE; return <g key={panel.id} transform={`translate(${p.x} ${p.y}) rotate(${-panel.rotation})`} onPointerDown={(event) => { event.stopPropagation(); select(panel.id); setDraggingId(panel.id); (event.currentTarget as SVGGElement).setPointerCapture(event.pointerId); }} onPointerUp={() => setDraggingId(null)} onDoubleClick={(event) => { event.stopPropagation(); rotatePanel(panel.id); }}><rect x={-w / 2} y={-h / 2} width={w} height={h} rx="2" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth={selectedIds.includes(panel.id) ? 3 : 1.5} /><path d={`M ${-w / 2} 0 H ${w / 2} M 0 ${-h / 2} V ${h / 2}`} stroke="currentColor" strokeOpacity="0.35" /></g>; })}
            {preview && cursor && <g pointerEvents="none" opacity="0.72"><rect x={worldToSvg(preview.placement.center).x - (PANEL.widthM * SCALE) / 2} y={worldToSvg(preview.placement.center).y - (PANEL.lengthM * SCALE) / 2} width={PANEL.widthM * SCALE} height={PANEL.lengthM * SCALE} fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" /></g>}
          </svg>
          <div className="stage-controls"><button onClick={() => setZoom(zoom - .25)}>−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(zoom + .25)}>+</button></div>
          {activeTool === "panel" && <div style={{ position: "absolute", left: 16, bottom: 16, fontSize: 12 }}>Panel tool · {preview?.valid ? "Valid placement" : "Move onto usable roof"}</div>}
        </section>
        <aside className="design-properties"><span className="toolbar-title">PROPERTIES</span><h3>Design</h3><div className="property"><span>Tool</span><strong>{activeTool}</strong></div><div className="property"><span>Zoom</span><strong>{Math.round(zoom * 100)}%</strong></div>{selected && <><hr/><h3>Selected Panel</h3><div className="property"><span>Model</span><strong>{PANEL.model}</strong></div><div className="property"><span>Power</span><strong>{PANEL.powerWatts} W</strong></div><div className="property"><span>Rotation</span><strong>{selected.rotation}°</strong></div></>}<hr/><h3>System</h3><div className="metric"><strong>{panels.length}</strong><span>Panels</span></div><div className="metric"><strong>{capacity.toFixed(1)} kWp</strong><span>Capacity</span></div><div className="metric"><strong>60 m²</strong><span>Roof area</span></div></aside>
      </div>
      <footer className="design-footer"><span>{activeTool === "panel" ? (preview?.valid ? "Ready to place" : "Invalid placement") : "Ready"}</span><span>Grid · 0.5 m</span><span>Coordinates · {cursor ? `${cursor.x.toFixed(2)}, ${cursor.y.toFixed(2)}` : "0, 0"}</span></footer>
    </div>
  );
}
