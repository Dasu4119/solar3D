import type { Point } from "@/engine/geometry/point";
import type { PanelPlacement } from "@/engine/solar/placement";
import { invokeFunction } from "@/shared/api/client";

export interface DesignPersistenceSnapshot {
  designId: string;
  versionId?: string;
  roof: Point[];
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
  roofs?: Array<{ geometry?: Point[] }>;
  panel_placements?: Array<{ id?: string; x: number; y: number; z?: number | null; rotation_degrees?: number | null; tilt_degrees?: number | null }>;
  design_version?: { id?: string; metrics?: Record<string, unknown> };
}

export interface ProjectApiInvoker {
  invoke(action: string, body: Record<string, unknown>): Promise<unknown>;
}

export class ApiDesignPersistence implements DesignPersistence {
  constructor(private readonly api: ProjectApiInvoker) {}

  async load(designId: string): Promise<DesignPersistenceSnapshot | null> {
    const response = await this.api.invoke("get_design", { design_id: designId }) as ProjectApiResponse;
    if (!response.success || !response.active_version) return null;
    const roof = response.roofs?.[0]?.geometry ?? [];
    const panelPlacements = (response.panel_placements ?? []).map((placement) => ({
      id: placement.id ?? crypto.randomUUID(),
      panelId: "",
      center: { x: placement.x, y: placement.y },
      rotation: (placement.rotation_degrees ?? 0) as PanelPlacement["rotation"],
    }));
    return { designId, versionId: response.active_version.id, roof, panelPlacements, metrics: response.active_version.metrics };
  }

  async save(snapshot: DesignPersistenceSnapshot): Promise<DesignPersistenceSnapshot> {
    const response = await this.api.invoke("save_design", {
      design_id: snapshot.designId,
      roof: { geometry: snapshot.roof },
      panel_placements: snapshot.panelPlacements,
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
