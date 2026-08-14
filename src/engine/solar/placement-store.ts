import type { PanelPlacement } from "@/engine/solar/placement";

export interface PlacementStore {
  list(): PanelPlacement[];
  get(id: string): PanelPlacement | undefined;
  upsert(placement: PanelPlacement): void;
  remove(id: string): boolean;
  clear(): void;
}

export class InMemoryPlacementStore implements PlacementStore {
  private readonly placements = new Map<string, PanelPlacement>();

  list(): PanelPlacement[] {
    return Array.from(this.placements.values(), clonePlacement);
  }

  get(id: string): PanelPlacement | undefined {
    const placement = this.placements.get(id);
    return placement ? clonePlacement(placement) : undefined;
  }

  upsert(placement: PanelPlacement): void {
    if (!placement.id.trim()) throw new Error("Placement id is required");
    if (!placement.panelId.trim()) throw new Error("Placement panel id is required");
    this.placements.set(placement.id, clonePlacement(placement));
  }

  remove(id: string): boolean {
    return this.placements.delete(id);
  }

  clear(): void {
    this.placements.clear();
  }
}

function clonePlacement(placement: PanelPlacement): PanelPlacement {
  return {
    ...placement,
    center: { ...placement.center },
  };
}
