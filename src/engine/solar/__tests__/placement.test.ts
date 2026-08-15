import { describe, expect, it } from "vitest";
import type { Point } from "@/engine/geometry/point";
import { validatePanelSpec, type SolarPanelSpec } from "@/engine/solar/panel";
import { createPlacementPreview } from "@/engine/solar/placement-preview";
import type { PanelPlacement } from "@/engine/solar/placement";
import { validatePanelPlacement } from "@/engine/solar/roof-validation";

const panel: SolarPanelSpec = {
  id: "reference-400w",
  manufacturer: "Reference",
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

const existing: PanelPlacement[] = [
  { id: "p1", panelId: panel.id, center: { x: 3, y: 2 }, rotation: 0 },
];

const catalog = (id: string) => id === panel.id ? panel : undefined;

describe("solar panel domain", () => {
  it("accepts a valid panel specification", () => {
    expect(() => validatePanelSpec(panel)).not.toThrow();
  });

  it("rejects invalid efficiency", () => {
    expect(() => validatePanelSpec({ ...panel, efficiency: 1.2 })).toThrow();
  });

  it("accepts a panel fully inside the roof", () => {
    const placement: PanelPlacement = { id: "p2", panelId: panel.id, center: { x: 7, y: 2 }, rotation: 0 };
    expect(validatePanelPlacement(roof, placement, panel).valid).toBe(true);
  });

  it("rejects a panel crossing the roof boundary", () => {
    const placement: PanelPlacement = { id: "p2", panelId: panel.id, center: { x: 0.25, y: 2 }, rotation: 0 };
    expect(validatePanelPlacement(roof, placement, panel).valid).toBe(false);
  });

  it("rejects a panel that violates setbacks", () => {
    const placement: PanelPlacement = { id: "p2", panelId: panel.id, center: { x: 1, y: 1.5 }, rotation: 0 };
    const result = validatePanelPlacement(roof, placement, panel, { northM: 0, eastM: 0, southM: 1, westM: 0 });
    expect(result.valid).toBe(false);
  });

  it("rejects overlapping panels in the live preview", () => {
    const result = createPlacementPreview(roof, panel, { x: 3.2, y: 2 }, 0, existing, catalog, undefined, 0.1);
    expect(result.valid).toBe(false);
    expect(result.reasons.join(" ")).toContain("overlaps");
  });

  it("allows a rotated panel when its footprint fits", () => {
    const result = createPlacementPreview(roof, panel, { x: 8, y: 4 }, 90, [], catalog);
    expect(result.valid).toBe(true);
  });
});
