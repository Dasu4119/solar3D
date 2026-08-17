import type { Point } from "@/engine/geometry/point";
import type { RoofPlane } from "@/engine/roof/plane-extraction";
import type { PanelPlacement } from "@/engine/solar/placement";

export interface DesignPersistenceSnapshot {
  designId: string;
  versionId?: string;
  roof: Point[];
  roofPlanes?: RoofPlane[];
  panelPlacements: PanelPlacement[];
  metrics?: Record<string, unknown>;
}

export interface DesignPersistence {
  load(designId: string): Promise<DesignPersistenceSnapshot | null>;
  save(snapshot: DesignPersistenceSnapshot): Promise<DesignPersistenceSnapshot>;
}

export interface PersistedRoofGeometry {
  schemaVersion: 1;
  mesh: Point[];
  planes: RoofPlane[];
}

export interface ProjectApiResponse {
  success?: boolean;
  error?: string;
  active_version?: { id?: string; metrics?: Record<string, unknown> } | null;
  roofs?: Array<{ geometry?: Point[] | PersistedRoofGeometry }>;
  panel_placements?: Array<{
    id?: string;
    x: number;
    y: number;
    z?: number | null;
    rotation_degrees?: number | null;
    tilt_degrees?: number | null;
  }>;
  design_version?: { id?: string; metrics?: Record<string, unknown> };
}

export interface ProjectApiInvoker {
  invoke<T>(action: string, body: Record<string, unknown>): Promise<T>;
}

function decodeRoofGeometry(geometry: ProjectApiResponse["roofs"] extends Array<infer R> ? R extends { geometry?: infer G } ? G : never : never) {
  if (geometry && !Array.isArray(geometry) && geometry.schemaVersion === 1) {
    return { mesh: geometry.mesh, roofPlanes: geometry.planes };
  }
  return { mesh: Array.isArray(geometry) ? geometry : [], roofPlanes: [] as RoofPlane[] };
}

export class ApiDesignPersistence implements DesignPersistence {
  constructor(private readonly api: ProjectApiInvoker) {}

  async load(designId: string): Promise<DesignPersistenceSnapshot | null> {
    const response = await this.api.invoke<ProjectApiResponse>("get_design", { design_id: designId });
    if (!response.success || !response.active_version) return null;

    const decoded = decodeRoofGeometry(response.roofs?.[0]?.geometry);
    const panelPlacements = (response.panel_placements ?? []).map((placement) => ({
      id: placement.id ?? crypto.randomUUID(),
      panelId: "",
      center: { x: placement.x, y: placement.y },
      rotation: (placement.rotation_degrees ?? 0) as PanelPlacement["rotation"],
    }));

    return {
      designId,
      versionId: response.active_version.id,
      roof: decoded.mesh,
      roofPlanes: decoded.roofPlanes,
      panelPlacements,
      metrics: response.active_version.metrics,
    };
  }

  async save(snapshot: DesignPersistenceSnapshot): Promise<DesignPersistenceSnapshot> {
    const roofGeometry: PersistedRoofGeometry = {
      schemaVersion: 1,
      mesh: snapshot.roof,
      planes: snapshot.roofPlanes ?? [],
    };
    const response = await this.api.invoke<ProjectApiResponse>("save_design", {
      design_id: snapshot.designId,
      roof: { geometry: roofGeometry },
      panel_placements: snapshot.panelPlacements,
      metrics: snapshot.metrics ?? { panel_count: snapshot.panelPlacements.length },
    });

    if (!response.success || !response.design_version?.id) {
      throw new Error(response.error ?? "Unable to persist design");
    }

    return { ...snapshot, versionId: response.design_version.id };
  }
}

export function createDesignPersistence(api: ProjectApiInvoker): DesignPersistence {
  return new ApiDesignPersistence(api);
}
