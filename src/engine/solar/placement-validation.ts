import type { Point } from "@/engine/geometry/point";
import type { SolarPanelSpec } from "@/engine/solar/panel";
import { placementOverlapsAny, type PanelPlacement } from "@/engine/solar/placement";
import { validatePanelPlacement, type Setback } from "@/engine/solar/roof-validation";

export interface PlacementValidationResult {
  valid: boolean;
  reasons: string[];
}

export interface PlacementValidationContext {
  roof: Point[];
  setback?: Setback;
  existing: PanelPlacement[];
  panelById: (id: string) => SolarPanelSpec | undefined;
  clearanceM?: number;
}

export function validatePlacement(
  placement: PanelPlacement,
  panel: SolarPanelSpec,
  context: PlacementValidationContext,
): PlacementValidationResult {
  const result = validatePanelPlacement(context.roof, placement, panel, context.setback);
  const reasons = [...result.reasons];

  if (placementOverlapsAny(
    placement,
    panel,
    context.existing,
    context.panelById,
    context.clearanceM ?? 0,
  )) {
    reasons.push("Panel overlaps another panel or its required clearance zone");
  }

  return { valid: reasons.length === 0, reasons };
}

export function canPlacePanel(
  placement: PanelPlacement,
  panel: SolarPanelSpec,
  context: PlacementValidationContext,
): boolean {
  return validatePlacement(placement, panel, context).valid;
}
