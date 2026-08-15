import type { Point } from "@/engine/geometry/point";
import type { PanelPlacement } from "@/engine/solar/placement";

export interface DesignPersistenceSnapshot {
  designId: string;
  versionId?: string;
  roof: Point[];
  panelPlacements: PanelPlacement[];
}

export interface DesignPersistence {
  load(designId: string): Promise<DesignPersistenceSnapshot | null>;
  save(snapshot: DesignPersistenceSnapshot): Promise<DesignPersistenceSnapshot>;
}

export interface DesignPersistenceTransport {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
}

export class ApiDesignPersistence implements DesignPersistence {
  constructor(private readonly transport: DesignPersistenceTransport) {}

  load(designId: string): Promise<DesignPersistenceSnapshot | null> {
    return this.transport.get<DesignPersistenceSnapshot | null>(`/api/designs/${encodeURIComponent(designId)}`);
  }

  save(snapshot: DesignPersistenceSnapshot): Promise<DesignPersistenceSnapshot> {
    return this.transport.post<DesignPersistenceSnapshot>(
      `/api/designs/${encodeURIComponent(snapshot.designId)}/versions`,
      snapshot,
    );
  }
}

export function createDesignPersistence(transport: DesignPersistenceTransport): DesignPersistence {
  return new ApiDesignPersistence(transport);
}
