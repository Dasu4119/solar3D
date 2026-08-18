import { describe, expect, it } from "vitest";
import { buildUsableRoofRegion } from "@/engine/geometry/roof-constraints";
import type { Point } from "@/engine/geometry/point";
import type { SolarPanelSpec } from "@/engine/solar/panel";
import { panelFootprint, polygonsIntersect } from "../obstacles";
import { generateSolarLayout } from "../optimizer";

const roof: Point[] = [
  { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 0, y: 5 },
];
const panel: SolarPanelSpec = {
  id: "test-400w", manufacturer: "Test", model: "400W",
  widthM: 1, lengthM: 2, powerWatts: 400, efficiency: 0.2,
};

describe("automatic solar layout", () => {
  it("generates deterministic valid placements", () => {
    const a = generateSolarLayout({ roof, panel, constraints: { edgeGapM: 0.2, panelGapM: 0.1, allowedRotations: [0] } });
    const b = generateSolarLayout({ roof, panel, constraints: { edgeGapM: 0.2, panelGapM: 0.1, allowedRotations: [0] } });
    expect(a.placements.length).toBeGreaterThan(0);
    expect(a.placements).toEqual(b.placements);
    expect(a.dcCapacityWatts).toBe(a.placements.length * panel.powerWatts);
  });

  it("reduces placement count when setbacks increase", () => {
    const open = generateSolarLayout({ roof, panel, constraints: { edgeGapM: 0 } });
    const restricted = generateSolarLayout({ roof, panel, constraints: { edgeGapM: 1 } });
    expect(restricted.placements.length).toBeLessThanOrEqual(open.placements.length);
  });

  it("passes canonical P1-B regions through the optimizer", () => {
    const canonical = buildUsableRoofRegion(
      roof,
      [{
        id: "chimney-1",
        type: "chimney",
        footprint: [
          { x: 4, y: 1.5 },
          { x: 6, y: 1.5 },
          { x: 6, y: 3.5 },
          { x: 4, y: 3.5 },
        ],
      }],
      { obstacleClearanceM: 1 },
    );

    const result = generateSolarLayout({
      roof,
      panel,
      constraints: { allowedRotations: [0] },
      usableRoofRegions: [canonical],
    });

    expect(result.placements.length).toBeGreaterThan(0);
    expect(result.placements.every((placement) => placement.center.x < 3 || placement.center.x > 7)).toBe(true);
  });

  it("never returns overlapping panels when both orientations are enabled", () => {
    const result = generateSolarLayout({
      roof,
      panel,
      constraints: { panelGapM: 0.1, allowedRotations: [0, 90] },
    });

    for (let i = 0; i < result.placements.length; i++) {
      for (let j = i + 1; j < result.placements.length; j++) {
        const a = result.placements[i];
        const b = result.placements[j];
        expect(polygonsIntersect(
          panelFootprint(a.center, panel.widthM, panel.lengthM, a.rotation),
          panelFootprint(b.center, panel.widthM, panel.lengthM, b.rotation),
        )).toBe(false);
      }
    }
  });

  it("selects the same packed layout for repeated requests", () => {
    const request = {
      roof,
      panel,
      constraints: { panelGapM: 0.1, allowedRotations: [0, 90] as number[] },
    };
    expect(generateSolarLayout(request).placements).toEqual(generateSolarLayout(request).placements);
  });
});
