import { describe, expect, it } from "vitest";
import type { Point } from "@/engine/geometry/point";
import type { SolarPanelSpec } from "@/engine/solar/panel";
import type { PanelPlacement } from "@/engine/solar/placement";
import { addPanelPlacement, movePanelPlacement, removePanelPlacement, rotatePanelPlacement, type PanelDesignState } from "@/engine/solar/panel-design";

const panel: SolarPanelSpec = {
  id: "test-400w",
  manufacturer: "Test",
  model: "400W",
  widthM: 1,
  lengthM: 2,
  powerWatts: 400,
  efficiency: 0.2,
};

const roof: Point[] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 5 },
  { x: 0, y: 5 },
];

const context = { roof, panelById: (id: string) => id === panel.id ? panel : undefined };
const placement: PanelPlacement = { id: "panel-1", panelId: panel.id, center: { x: 3, y: 2 }, rotation: 0 };
const empty: PanelDesignState = { placements: [], selectedPlacementId: null };

describe("panel design commands", () => {
  it("adds and selects a valid panel", () => {
    const state = addPanelPlacement(empty, placement, context);
    expect(state.placements).toHaveLength(1);
    expect(state.selectedPlacementId).toBe(placement.id);
  });

  it("moves a panel through validation", () => {
    const state = addPanelPlacement(empty, placement, context);
    const moved = movePanelPlacement(state, placement.id, { x: 6, y: 2 }, context);
    expect(moved.placements[0].center).toEqual({ x: 6, y: 2 });
  });

  it("rejects an invalid move", () => {
    const state = addPanelPlacement(empty, placement, context);
    expect(() => movePanelPlacement(state, placement.id, { x: 0.2, y: 2 }, context)).toThrow();
  });

  it("rotates a panel through validation", () => {
    const state = addPanelPlacement(empty, placement, context);
    const rotated = rotatePanelPlacement(state, placement.id, context);
    expect(rotated.placements[0].rotation).toBe(90);
  });

  it("removes a panel and clears selection", () => {
    const state = addPanelPlacement(empty, placement, context);
    const removed = removePanelPlacement(state, placement.id);
    expect(removed.placements).toHaveLength(0);
    expect(removed.selectedPlacementId).toBeNull();
  });
});
