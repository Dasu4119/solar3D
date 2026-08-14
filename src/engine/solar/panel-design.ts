import type { Point } from "@/engine/geometry/point";
import type { SolarPanelSpec } from "@/engine/solar/panel";
import type { PanelPlacement } from "@/engine/solar/placement";
import type { Setback } from "@/engine/solar/roof-validation";
import { createPlacementPreview } from "@/engine/solar/placement-preview";

export interface PanelDesignState {
  placements: PanelPlacement[];
  selectedPlacementId: string | null;
}

export interface PanelDesignCommandContext {
  roof: Point[];
  panelById: (id: string) => SolarPanelSpec | undefined;
  setback?: Setback;
  clearance?: number;
}

export function addPanelPlacement(
  state: PanelDesignState,
  placement: PanelPlacement,
  context: PanelDesignCommandContext,
): PanelDesignState {
  const panel = context.panelById(placement.panelId);
  if (!panel) throw new Error(`Unknown panel: ${placement.panelId}`);
  const preview = createPlacementPreview(
    context.roof,
    panel,
    placement.center,
    placement.rotation,
    state.placements,
    context.panelById,
    context.setback,
    context.clearance,
    placement.id,
  );
  if (!preview.valid) throw new Error(preview.reasons.join("; "));
  return { placements: [...state.placements, { ...placement, center: { ...placement.center } }], selectedPlacementId: placement.id };
}

export function movePanelPlacement(
  state: PanelDesignState,
  id: string,
  center: Point,
  context: PanelDesignCommandContext,
): PanelDesignState {
  const existing = state.placements.find((placement) => placement.id === id);
  if (!existing) return state;
  const panel = context.panelById(existing.panelId);
  if (!panel) throw new Error(`Unknown panel: ${existing.panelId}`);
  const candidate = { ...existing, center: { ...center } };
  const others = state.placements.filter((placement) => placement.id !== id);
  const preview = createPlacementPreview(context.roof, panel, candidate.center, candidate.rotation, others, context.panelById, context.setback, context.clearance, id);
  if (!preview.valid) throw new Error(preview.reasons.join("; "));
  return { placements: state.placements.map((placement) => placement.id === id ? candidate : placement), selectedPlacementId: id };
}

export function rotatePanelPlacement(
  state: PanelDesignState,
  id: string,
  context: PanelDesignCommandContext,
): PanelDesignState {
  const existing = state.placements.find((placement) => placement.id === id);
  if (!existing) return state;
  const rotation = ((existing.rotation + 90) % 360) as PanelPlacement["rotation"];
  const panel = context.panelById(existing.panelId);
  if (!panel) throw new Error(`Unknown panel: ${existing.panelId}`);
  const candidate = { ...existing, rotation };
  const others = state.placements.filter((placement) => placement.id !== id);
  const preview = createPlacementPreview(context.roof, panel, candidate.center, candidate.rotation, others, context.panelById, context.setback, context.clearance, id);
  if (!preview.valid) throw new Error(preview.reasons.join("; "));
  return { placements: state.placements.map((placement) => placement.id === id ? candidate : placement), selectedPlacementId: id };
}

export function removePanelPlacement(state: PanelDesignState, id: string): PanelDesignState {
  return {
    placements: state.placements.filter((placement) => placement.id !== id),
    selectedPlacementId: state.selectedPlacementId === id ? null : state.selectedPlacementId,
  };
}
