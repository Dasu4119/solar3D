"use client";

import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useState } from "react";
import { createDesignPersistence } from "@/shared/api/design-persistence";
import { invokeFunction } from "@/shared/api/client";
import { mapDesignContext, type DesignContextApiResponse } from "@/shared/api/design-context";
import { useDesignEditorStore } from "@/features/design/editor-store";

type XY = { x: number; y: number };
type Panel = { id: string; x: number; y: number; rotation: number };
type SiteContext = {
  latitude: string;
  longitude: string;
  altitude: string;
};

function RoofModel({ points, panels, moduleSize }: {
  points: XY[];
  panels: Panel[];
  moduleSize: { widthM: number; lengthM: number };
}) {
  const geometry = useMemo(() => {
    if (points.length < 3) return null;
    const { Shape, ShapeGeometry } = require("three") as typeof import("three");
    const shape = new Shape();
    shape.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => shape.lineTo(point.x, point.y));
    shape.closePath();
    return new ShapeGeometry(shape);
  }, [points]);

  if (!geometry) return null;
  return (
    <group>
      <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <meshStandardMaterial color="#64748b" roughness={0.82} side={2} />
      </mesh>
      {panels.map((panel) => {
        const width = panel.rotation % 180 === 0 ? moduleSize.widthM : moduleSize.lengthM;
        const length = panel.rotation % 180 === 0 ? moduleSize.lengthM : moduleSize.widthM;
        return (
          <mesh key={panel.id} position={[panel.x, 0.09, -panel.y]} rotation={[0, -panel.rotation * Math.PI / 180, 0]} castShadow>
            <boxGeometry args={[width, 0.07, length]} />
            <meshStandardMaterial color="#0f5c86" metalness={0.48} roughness={0.32} />
          </mesh>
        );
      })}
      <mesh position={[0, -0.13, 0]} receiveShadow>
        <boxGeometry args={[Math.max(1, ...points.map((p) => p.x)) + 2, 0.2, Math.max(1, ...points.map((p) => p.y)) + 2]} />
        <meshStandardMaterial color="#cbd5e1" roughness={1} />
      </mesh>
    </group>
  );
}

export function SiteMappingWorkspace({ projectId }: { projectId: string }) {
  const hydrate = useDesignEditorStore((state) => state.hydrate);
  const panels = useDesignEditorStore((state) => state.panels);
  const roofs = useDesignEditorStore((state) => state.roofs);
  const [moduleSize, setModuleSize] = useState({ widthM: 1.134, lengthM: 2.278 });
  const [site, setSite] = useState<SiteContext>({ latitude: "", longitude: "", altitude: "0" });
  const [enu, setEnu] = useState<{ east_m: number; north_m: number; up_m: number } | null>(null);
  const [status, setStatus] = useState("Loading project geometry…");
  const [error, setError] = useState<string | null>(null);
  const persistence = useMemo(() => createDesignPersistence({
    invoke: (action, body) => invokeFunction("solar-project-api", { action, ...body }),
  }), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await invokeFunction<DesignContextApiResponse>("solar-project-api", {
          action: "get_design_context", project_id: projectId,
        });
        const context = mapDesignContext(response);
        if (cancelled) return;
        hydrate({ id: context.roofId ?? "roof-1", points: context.roof }, []);
        if (context.module) setModuleSize({ widthM: context.module.widthM, lengthM: context.module.lengthM });
        if (context.designVersionId) {
          const snapshot = await persistence.load(context.designId);
          if (!cancelled && snapshot) {
            hydrate(
              { id: snapshot.roofId ?? context.roofId ?? "roof-1", points: snapshot.roof.length ? snapshot.roof : context.roof },
              snapshot.panelPlacements.map((placement) => ({
                id: placement.id, x: placement.center.x, y: placement.center.y, rotation: Number(placement.rotation),
              })),
            );
          }
        }
        setStatus("Project geometry loaded");
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Could not load project geometry");
          setStatus("Project geometry unavailable");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [hydrate, persistence, projectId]);

  const roof = roofs[0]?.points ?? [];
  const updateSite = (key: keyof SiteContext, value: string) => setSite((current) => ({ ...current, [key]: value }));

  async function calculateLocalCoordinates() {
    setError(null);
    setEnu(null);
    const latitude = Number(site.latitude);
    const longitude = Number(site.longitude);
    const altitude = Number(site.altitude || "0");
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
        !Number.isFinite(altitude)) {
      setError("Enter a valid latitude, longitude and altitude.");
      return;
    }
    const api = "/api/geography/georeference";
    try {
      const response = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: { latitude_deg: latitude, longitude_deg: longitude, altitude_m: altitude },
          point: { latitude_deg: latitude, longitude_deg: longitude, altitude_m: altitude },
        }),
      });
      if (!response.ok) throw new Error("Geographic coordinate service is unavailable.");
      const body = await response.json();
      setEnu(body.point);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Coordinate conversion failed");
    }
  }

  return (
    <main className="mapping-shell">
      <header className="mapping-header">
        <div><strong>Solar3D</strong><span> / 3D Site Mapping</span><small>Project {projectId}</small></div>
        <a href={`/projects/${projectId}/design`}>← Back to 2D design</a>
      </header>
      <div className="mapping-layout">
        <aside className="mapping-panel">
          <h2>Site coordinates</h2>
          <p>Set the verified project origin. Coordinates are not inferred from an address.</p>
          <label>Latitude (WGS84)<input inputMode="decimal" value={site.latitude} onChange={(event) => updateSite("latitude", event.target.value)} placeholder="e.g. 16.3067" /></label>
          <label>Longitude (WGS84)<input inputMode="decimal" value={site.longitude} onChange={(event) => updateSite("longitude", event.target.value)} placeholder="e.g. 80.4365" /></label>
          <label>Ellipsoidal altitude (m)<input inputMode="decimal" value={site.altitude} onChange={(event) => updateSite("altitude", event.target.value)} /></label>
          <button onClick={calculateLocalCoordinates}>Validate site origin</button>
          {enu && <div className="mapping-result"><strong>ENU origin check</strong><span>E {enu.east_m.toFixed(4)} m</span><span>N {enu.north_m.toFixed(4)} m</span><span>U {enu.up_m.toFixed(4)} m</span></div>}
          <div className="mapping-meta"><strong>Coordinate frame</strong><span>WGS84 → local ENU</span><span>X East · Y North · Z Up</span></div>
          <div className="mapping-meta"><strong>Project model</strong><span>{roof.length} roof vertices</span><span>{panels.length} solar panels</span><span>{moduleSize.widthM.toFixed(3)} × {moduleSize.lengthM.toFixed(3)} m module</span></div>
          <p className="mapping-status">{status}</p>
          {error && <p className="mapping-error" role="alert">{error}</p>}
        </aside>
        <section className="mapping-view" aria-label="Interactive 3D roof model">
          <div className="mapping-view-label"><strong>Engineering 3D view</strong><span>Drag to orbit · Scroll to zoom · Right-drag to pan</span></div>
          {roof.length >= 3 ? (
            <Canvas shadows camera={{ position: [Math.max(8, ...roof.map((p) => p.x * 1.5)), 12, Math.max(8, ...roof.map((p) => p.y * 1.5))], fov: 42 }}>
              <color attach="background" args={["#e8eef4"]} />
              <ambientLight intensity={1.1} />
              <directionalLight position={[8, 15, 7]} intensity={2.2} castShadow />
              <Grid args={[100, 100]} position={[0, -0.25, 0]} cellSize={1} sectionSize={5} fadeDistance={70} />
              <RoofModel points={roof} panels={panels} moduleSize={moduleSize} />
              <OrbitControls makeDefault enableDamping />
            </Canvas>
          ) : <div className="mapping-empty">A saved roof polygon is required to render the 3D site model.</div>}
        </section>
      </div>
      <footer className="mapping-footer">This view renders the saved engineering roof model. A licensed satellite/terrain basemap provider is not configured yet; no imagery or roof measurements are fabricated.</footer>
      <style jsx>{`
        .mapping-shell{height:100vh;display:flex;flex-direction:column;background:#f8fafc;color:#0f172a;font:14px system-ui,sans-serif}
        .mapping-header{height:58px;display:flex;align-items:center;justify-content:space-between;padding:0 22px;border-bottom:1px solid #dbe3ec;background:white}
        .mapping-header strong{font-size:16px}.mapping-header span{color:#64748b}.mapping-header small{display:block;color:#94a3b8;font-size:11px}
        .mapping-header a{color:#2563eb;text-decoration:none}.mapping-layout{display:grid;grid-template-columns:290px 1fr;gap:14px;padding:14px;min-height:0;flex:1}
        .mapping-panel{background:white;border:1px solid #dbe3ec;border-radius:12px;padding:16px;overflow:auto}
        .mapping-panel h2{font-size:16px;margin:0 0 8px}.mapping-panel p{color:#64748b;font-size:12px;line-height:1.5}
        .mapping-panel label{display:flex;flex-direction:column;gap:5px;margin:14px 0;font-size:12px;font-weight:600}
        .mapping-panel input{height:38px;border:1px solid #cbd5e1;border-radius:7px;padding:0 10px;font:inherit;font-weight:400}
        .mapping-panel button{width:100%;height:38px;border:0;border-radius:7px;background:#0f5c86;color:white;font-weight:600;cursor:pointer}
        .mapping-result,.mapping-meta{display:flex;flex-direction:column;gap:5px;margin-top:14px;padding:12px;border-radius:8px;background:#f1f5f9;font-size:12px}
        .mapping-result strong,.mapping-meta strong{margin-bottom:3px}.mapping-status{font-size:11px}.mapping-error{color:#b91c1c}
        .mapping-view{position:relative;min-height:440px;border:1px solid #dbe3ec;border-radius:12px;overflow:hidden;background:#e8eef4}
        .mapping-view-label{position:absolute;z-index:2;top:12px;left:14px;display:flex;flex-direction:column;gap:3px;pointer-events:none;background:#ffffffdd;padding:8px 10px;border-radius:8px;font-size:12px}
        .mapping-view-label span{color:#64748b;font-size:11px}.mapping-empty{height:100%;display:grid;place-items:center;color:#64748b}
        .mapping-footer{padding:8px 18px;color:#64748b;font-size:11px;border-top:1px solid #dbe3ec;background:white}
        @media(max-width:760px){.mapping-layout{grid-template-columns:1fr;grid-template-rows:auto 1fr}.mapping-panel{max-height:300px}.mapping-view{min-height:400px}}
      `}</style>
    </main>
  );
}
