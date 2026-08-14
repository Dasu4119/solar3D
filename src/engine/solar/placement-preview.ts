import type { Point } from "@/engine/geometry/point";
import type { SolarPanelSpec } from "@/engine/solar/panel";
import type { PanelPlacement, PanelRotation } from "@/engine/solar/placement";
import { validatePanelPlacement, type Setback } from "@/engine/solar/roof-validation";
import { placementOverlapsAny } from "@/engine/solar/placement";

export interface PlacementPreview {
  placement: PanelPlacement;
  valid: boolean;
  reasons: string[];
}

export function createPlacementPreview(
  roof: Point[],
  panel: SolarPanelSpec,
  center: Point,
  rotation: PanelRotation,
  existing: PanelPlacement[],
  panelById: (id: string) => SolarPanelSpec | undefined,
  setback?: Setback,
  clearance = 0,
  id = "preview",
): PlacementPreview {
  const placement: PanelPlacement = { id, panelId: panel.id, center, rotation };
  const validation = validatePanelPlacement(roof, placement, panel, setback);
  if (!validation.valid) return { placement, valid: false, reasons: validation.reasons };
  if (placementOverlapsAny(placement, panel, existing, panelById, clearance)) {
    return { placement, valid: false, reasons: ["Panel overlaps another panel or its required clearance zone"] };
  }
  return { placement, valid: true, reasons: [] };
}
