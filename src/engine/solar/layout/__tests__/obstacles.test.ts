import { describe, expect, it } from "vitest";
import type { Point } from "@/engine/geometry/point";
import type { SolarPanelSpec } from "@/engine/solar/panel";
import { generateSolarLayout } from "../optimizer";

const roof: Point[] = [
  { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 0, y: 5 },
];
const panel: SolarPanelSpec = {
  id: "test-400w", manufacturer: "Test", model: "400W",
  widthM: 1, lengthM: 2, powerWatts: 400, efficiency: 0.2,
};

describe("layout obstacle constraints", () => {
  it("removes candidates intersecting an obstacle", () => {
    const unrestricted = generateSolarLayout({ roof, panel, constraints: { edgeGapM: 0, allowedRotations: [0] } });
    const blocked = generateSolarLayout({
      roof,
      panel,
      constraints: {
        edgeGapM: 0,
        allowedRotations: [0],
        obstacles: [{ id: "vent-1", polygon: [
          { x: 4, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 4 }, { x: 4, y: 4 },
        ] }],
      },
    });
    expect(blocked.placements.length).toBeLessThan(unrestricted.placements.length);
    expect(blocked.placements.every((p) => p.center.x < 4 || p.center.x > 6)).toBe(true);
  });

  it("honors obstacle clearance", () => {
    const result = generateSolarLayout({
      roof,
      panel,
      constraints: {
        edgeGapM: 0,
        allowedRotations: [0],
        obstacles: [{ id: "skylight", clearanceM: 1, polygon: [
          { x: 4, y: 2 }, { x: 5, y: 2 }, { x: 5, y: 3 }, { x: 4, y: 3 },
        ] }],
      },
    });
    expect(result.placements.some((p) => p.center.x >= 3 && p.center.x <= 6)).toBe(false);
  });
});
