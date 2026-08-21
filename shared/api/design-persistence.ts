import type { Point } from "@/engine/geometry/point";
import type { PanelPlacement } from "@/engine/solar/placement";
import { invokeFunction } from "@/shared/api/client";

export interface DesignPersistenceSnapshot {
  designId: string;
  versionId?: string;
  roof: Point[];
  roofId?: string | null;
  roofAreaM2?: number | null;
  moduleId?: string | null;
  setbackM?: number | null;
  panelPlacements: PanelPlacement[];
  metrics?: Record<string, unknown>;
}

export interface DesignPersistence {
  load(designId: string): Promise<DesignPersistenceSnapshot | null>;
  save(snapshot: DesignPersistenceSnapshot): Promise<DesignPersistenceSnapshot>;
}

export interface ProjectApiResponse {
  success?: boolean;
  error?: string;
  active_version?: { id?: string; metrics?: Record<string, unknown> } | null;
  roofs?: Array<{ id?: string; geometry?: Point[] | { schemaVersion?: number; mesh?: Point[]; planes?: unknown[] }; area_m2?: number | null }>;
  panel_placements?: Array<{ id?: string; x: number; y: number; z?: number | null; rotation_degrees?: number | null; tilt_degrees?: number | null }>;
  design_version?: { id?: string; metrics?: Record<string, unknown> };
}

export interface ProjectApiInvoker {
  invoke(action: string, body: Record<string, unknown>): Promise<unknown>;
}

function decodeRoofGeometry(geometry: unknown): Point[] {
  if (Array.isArray(geometry)) return geometry as Point[];
  if (geometry && typeof geometry === "object" && Array.isArray((geometry as { mesh?: unknown }).mesh)) {
    return (geometry as { mesh: Point[] }).mesh;
  }
  return [];
}

export class ApiDesignPersistence implements DesignPersistence {
  constructor(private readonly api: ProjectApiInvoker) {}

  async load(designId: string): Promise<DesignPersistenceSnapshot | null> {
    const response = await this.api.invoke("get_design", { design_id: designId }) as ProjectApiResponse;
    if (!response.success || !response.active_version) return null;
    const persistedRoof = response.roofs?.[0];
    const roof = decodeRoofGeometry(persistedRoof?.geometry);
    const panelPlacements = (response.panel_placements ?? []).map((placement) => ({
      id: placement.id ?? crypto.randomUUID(),
      panelId: "",
      center: { x: placement.x, y: placement.y },
      rotation: (placement.rotation_degrees ?? 0) as PanelPlacement["rotation"],
    }));
    return {
      designId,
      versionId: response.active_version.id,
      roof,
      roofId: persistedRoof?.id ?? null,
      roofAreaM2: persistedRoof?.area_m2 ?? null,
      panelPlacements,
      metrics: response.active_version.metrics,
    };
  }

  async save(snapshot: DesignPersistenceSnapshot): Promise<DesignPersistenceSnapshot> {
    const response = await this.api.invoke("save_design", {
      design_id: snapshot.designId,
      roof: { ...(snapshot.roofId ? { id: snapshot.roofId } : {}), geometry: snapshot.roof, area_m2: snapshot.roofAreaM2 ?? null },
      module_id: snapshot.moduleId ?? null,
      setback_m: snapshot.setbackM ?? null,
      panel_placements: snapshot.panelPlacements,
      dc_capacity_kw: snapshot.metrics?.dc_capacity_kw ?? 0,
      metrics: snapshot.metrics ?? { panel_count: snapshot.panelPlacements.length },
    }) as ProjectApiResponse;
    if (!response.success || !response.design_version?.id) throw new Error(response.error ?? "Unable to persist design");
    return { ...snapshot, versionId: response.design_version.id };
  }
}

export function createDesignPersistence(api: ProjectApiInvoker): DesignPersistence {
  return new ApiDesignPersistence(api);
}

export function createAuthenticatedDesignPersistence(): DesignPersistence {
  return new ApiDesignPersistence({ invoke: (action, body) => invokeFunction("solar-project-api", { action, ...body }) });
}
