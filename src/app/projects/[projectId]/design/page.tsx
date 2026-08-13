"use client";

import Link from "next/link";
import { useState } from "react";

const tools = ["Select", "Roof", "Panel", "Obstacle", "Measure"];

export default function DesignPage() {
  const [tool, setTool] = useState("Select");
  return (
    <main className="designer-shell">
      <header className="designer-topbar"><div><Link href="/projects" className="brand">Solar3D</Link><span className="crumb">/ Commercial Rooftop / Design</span></div><div className="designer-actions"><button>Save</button><button className="primary">Generate proposal</button></div></header>
      <div className="designer-body">
        <aside className="tool-panel"><p className="eyebrow">TOOLS</p>{tools.map((item) => <button key={item} className={tool === item ? "tool active" : "tool"} onClick={() => setTool(item)}>{item}</button>)}<div className="tool-help"><strong>{tool}</strong><p>Choose a tool, then interact with the design canvas.</p></div></aside>
        <section className="canvas-area"><div className="canvas-toolbar"><span>2D CAD</span><span className="muted">Grid · Snap · Dimensions</span></div><div className="canvas"><div className="roof-shape"><div className="panel-grid">{Array.from({ length: 24 }, (_, i) => <span key={i} />)}</div></div><div className="north">N</div><div className="scale">10 m</div></div><footer className="design-status"><span>Ready</span><span>24 panels</span><span>82.4 kWp</span><span>Roof coverage 68%</span></footer></section>
        <aside className="properties"><p className="eyebrow">PROPERTIES</p><h2>Design summary</h2><div className="property"><span>Roof area</span><strong>1,240 m²</strong></div><div className="property"><span>Panels</span><strong>152</strong></div><div className="property"><span>System size</span><strong>82.4 kWp</strong></div><div className="property"><span>Orientation</span><strong>South</strong></div><hr/><h3>Next step</h3><p className="muted">Review panel placement, then run Auto Layout to optimize the design.</p><button className="primary full">Run Auto Layout</button></aside>
      </div>
    </main>
  );
}
