"use client";

import { useDesignEditorStore } from "./editor-store";
import type { DesignTool } from "./types";

const tools: { id: DesignTool; label: string; hint: string }[] = [
  { id: "select", label: "Select", hint: "V" },
  { id: "roof", label: "Roof", hint: "R" },
  { id: "panel", label: "Panel", hint: "P" },
  { id: "obstacle", label: "Obstacle", hint: "O" },
  { id: "measure", label: "Measure", hint: "M" },
];

export function DesignWorkspace() {
  const { activeTool, setTool, zoom, setZoom } = useDesignEditorStore();

  return (
    <div className="design-shell">
      <header className="design-header"><strong>Solar3D</strong><span> / Design</span><div className="design-actions"><button>Save</button><button className="primary">Generate proposal</button></div></header>
      <div className="design-body">
        <aside className="design-toolbar"><span className="toolbar-title">TOOLS</span>{tools.map((tool) => <button key={tool.id} className={activeTool === tool.id ? "tool active" : "tool"} onClick={() => setTool(tool.id)}><span>{tool.label}</span><kbd>{tool.hint}</kbd></button>)}</aside>
        <section className="cad-stage"><div className="stage-grid"/><div className="roof-outline"><span>Roof area</span></div><div className="stage-controls"><button onClick={() => setZoom(zoom - .25)}>−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(zoom + .25)}>+</button></div></section>
        <aside className="design-properties"><span className="toolbar-title">PROPERTIES</span><h3>Design</h3><div className="property"><span>Tool</span><strong>{activeTool}</strong></div><div className="property"><span>Zoom</span><strong>{Math.round(zoom * 100)}%</strong></div><hr/><h3>System</h3><div className="metric"><strong>—</strong><span>Panels</span></div><div className="metric"><strong>— kWp</strong><span>Capacity</span></div><div className="metric"><strong>— m²</strong><span>Roof area</span></div></aside>
      </div>
      <footer className="design-footer"><span>Ready</span><span>Grid · 0.5 m</span><span>Coordinates · 0, 0</span></footer>
    </div>
  );
}
