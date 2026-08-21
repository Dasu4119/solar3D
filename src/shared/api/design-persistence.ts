import type { Point } from "@/engine/geometry/point";
import type { RoofPlane } from "@/engine/roof/plane-extraction";
import type { PanelPlacement } from "@/engine/solar/placement";
import { invokeFunction } from "@/shared/api/client";

export interface DesignPersistenceSnapshot {
  designId: string; versionId?: string; roof: Point[]; roofPlanes?: RoofPlane[]; roofId?: string | null; roofAreaM2?: number | null; moduleId?: string | null; setbackM?: number | null; panelPlacements: PanelPlacement[]; metrics?: Record<string, unknown>;
}
export interface DesignPersistence { load(designId: string): Promise<DesignPersistenceSnapshot | null>; save(snapshot: DesignPersistenceSnapshot): Promise<DesignPersistenceSnapshot>; }
export interface PersistedRoofGeometry { schemaVersion: 1; mesh: Point[]; planes: RoofPlane[]; }
export interface ProjectApiResponse { success?: boolean; error?: string; active_version?: { id?: string; metrics?: Record<string, unknown> } | null; roofs?: Array<{ id?: string; geometry?: Point[] | PersistedRoofGeometry; area_m2?: number | null }>; panel_placements?: Array<{ id?: string; x: number; y: number; z?: number | null; rotation_degrees?: number | null; tilt_degrees?: number | null }>; design_version?: { id?: string; metrics?: Record<string, unknown> }; }
export interface ProjectApiInvoker { invoke(action: string, body: Record<string, unknown>): Promise<unknown>; }
export function encodeRoofGeometry(mesh: Point[], roofPlanes: RoofPlane[] = []): PersistedRoofGeometry { return { schemaVersion: 1, mesh, planes: roofPlanes }; }
export function decodeRoofGeometry(geometry: unknown): { mesh: Point[]; roofPlanes: RoofPlane[] } { if (geometry && typeof geometry === "object" && (geometry as PersistedRoofGeometry).schemaVersion === 1) return { mesh: (geometry as PersistedRoofGeometry).mesh, roofPlanes: (geometry as PersistedRoofGeometry).planes }; return { mesh: Array.isArray(geometry) ? geometry as Point[] : [], roofPlanes: [] }; }

export class ApiDesignPersistence implements DesignPersistence {
  constructor(private readonly api: ProjectApiInvoker) {}
  async load(designId: string): Promise<DesignPersistenceSnapshot | null> {
    const response = await this.api.invoke("get_design", { design_id: designId }) as ProjectApiResponse;
    if (!response.success || !response.active_version) return null;
    const persistedRoof = response.roofs?.[0]; const decoded = decodeRoofGeometry(persistedRoof?.geometry);
    const panelPlacements = (response.panel_placements ?? []).map((placement) => ({ id: placement.id ?? crypto.randomUUID(), panelId: "", center: { x: placement.x, y: placement.y }, rotation: (placement.rotation_degrees ?? 0) as PanelPlacement["rotation"] }));
    return { designId, versionId: response.active_version.id, roof: decoded.mesh, roofPlanes: decoded.roofPlanes, roofId: persistedRoof?.id ?? null, roofAreaM2: persistedRoof?.area_m2 ?? null, panelPlacements, metrics: response.active_version.metrics };
  }
  async save(snapshot: DesignPersistenceSnapshot): Promise<DesignPersistenceSnapshot> {
    const response = await this.api.invoke("save_design", { design_id: snapshot.designId, roof: { ...(snapshot.roofId ? { id: snapshot.roofId } : {}), geometry: encodeRoofGeometry(snapshot.roof, snapshot.roofPlanes ?? []), area_m2: snapshot.roofAreaM2 ?? null }, module_id: snapshot.moduleId ?? null, setback_m: snapshot.setbackM ?? null, panel_placements: snapshot.panelPlacements, dc_capacity_kw: snapshot.metrics?.dc_capacity_kw ?? 0, metrics: snapshot.metrics ?? { panel_count: snapshot.panelPlacements.length } }) as ProjectApiResponse;
    if (!response.success || !response.design_version?.id) throw new Error(response.error ?? "Unable to persist design");
    return { ...snapshot, versionId: response.design_version.id };
  }
}
export function createDesignPersistence(api: ProjectApiInvoker): DesignPersistence { return new ApiDesignPersistence(api); }
export function createAuthenticatedDesignPersistence(): DesignPersistence { return new ApiDesignPersistence({ invoke: (action, body) => invokeFunction("solar-project-api", { action, ...body }) }); }
