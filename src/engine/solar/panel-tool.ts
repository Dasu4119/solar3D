import type { Point } from "@/engine/geometry/point";
import type { SolarPanelSpec } from "@/engine/solar/panel";
import type { PanelPlacement, PanelRotation } from "@/engine/solar/placement";
import { createPlacementPreview, type PlacementPreview } from "@/engine/solar/placement-preview";
import type { Setback } from "@/engine/solar/roof-validation";

export interface PanelToolState {
  active: boolean;
  panelId: string | null;
  rotation: PanelRotation;
  preview: PlacementPreview | null;
}

export class PanelToolController {
  private state: PanelToolState = { active: false, panelId: null, rotation: 0, preview: null };

  activate(panelId: string): void {
    this.state = { ...this.state, active: true, panelId, preview: null };
  }

  deactivate(): void {
    this.state = { active: false, panelId: null, rotation: 0, preview: null };
  }

  rotate(): PanelRotation {
    const rotation = ((this.state.rotation + 90) % 360) as PanelRotation;
    this.state = { ...this.state, rotation };
    return rotation;
  }

  updatePreview(args: {
    roof: Point[];
    center: Point;
    panel: SolarPanelSpec;
    existing: PanelPlacement[];
    panelById: (id: string) => SolarPanelSpec | undefined;
    setback?: Setback;
    clearance?: number;
  }): PlacementPreview | null {
    if (!this.state.active || this.state.panelId !== args.panel.id) return null;
    const preview = createPlacementPreview(
      args.roof,
      args.panel,
      args.center,
      this.state.rotation,
      args.existing,
      args.panelById,
      args.setback,
      args.clearance,
    );
    this.state = { ...this.state, preview };
    return preview;
  }

  getState(): PanelToolState {
    return { ...this.state, preview: this.state.preview ? { ...this.state.preview, placement: { ...this.state.preview.placement } } : null };
  }
}
