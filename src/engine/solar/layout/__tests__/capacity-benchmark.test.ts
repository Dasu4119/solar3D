import { describe, expect, it } from "vitest";
import type { Point } from "@/engine/geometry/point";
import type { SolarPanelSpec } from "@/engine/solar/panel";
import { buildUsableRoofRegion } from "@/engine/geometry/roof-constraints";
import { generateSolarLayout } from "../optimizer";

const roof: Point[] = [
  { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 0, y: 5 },
];

const panel: SolarPanelSpec = {
  id: "benchmark-400w", manufacturer: "Test", model: "400W",
  widthM: 1, lengthM: 2, powerWatts: 400, efficiency: 0.2,
};

function polygonArea(points: Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

function usableArea(region: { outer: Point[]; holes?: Point[][] }): number {
  return polygonArea(region.outer) - (region.holes ?? []).reduce((sum, hole) => sum + polygonArea(hole), 0);
}

describe("P1-C panel capacity benchmarks", () => {
  it("compares portrait and landscape capacity deterministically", () => {
    const portrait = generateSolarLayout({
      roof,
      panel,
      constraints: { edgeGapM: 0.2, panelGapM: 0.1, allowedRotations: [0] },
    });
    const landscape = generateSolarLayout({
      roof,
      panel,
      constraints: { edgeGapM: 0.2, panelGapM: 0.1, allowedRotations: [90] },
    });

    expect(portrait.dcCapacityWatts).toBe(portrait.placements.length * panel.powerWatts);
    expect(landscape.dcCapacityWatts).toBe(landscape.placements.length * panel.powerWatts);
    expect(portrait.placements).toEqual(generateSolarLayout({
      roof,
      panel,
      constraints: { edgeGapM: 0.2, panelGapM: 0.1, allowedRotations: [0] },
    }).placements);
    expect(landscape.placements).toEqual(generateSolarLayout({
      roof,
      panel,
      constraints: { edgeGapM: 0.2, panelGapM: 0.1, allowedRotations: [90] },
    }).placements);
  });

  it("never increases capacity when panel spacing increases", () => {
    const tight = generateSolarLayout({
      roof,
      panel,
      constraints: { edgeGapM: 0.2, panelGapM: 0, allowedRotations: [0, 90] },
    });
    const spaced = generateSolarLayout({
      roof,
      panel,
      constraints: { edgeGapM: 0.2, panelGapM: 0.25, allowedRotations: [0, 90] },
    });

    expect(spaced.placements.length).toBeLessThanOrEqual(tight.placements.length);
    expect(spaced.dcCapacityWatts).toBeLessThanOrEqual(tight.dcCapacityWatts);
  });

  it("measures usable-area utilization and preserves canonical obstacle exclusion", () => {
    const region = buildUsableRoofRegion(
      roof,
      [{
        id: "benchmark-chimney",
        type: "chimney",
        footprint: [
          { x: 4, y: 1.5 }, { x: 6, y: 1.5 },
          { x: 6, y: 3.5 }, { x: 4, y: 3.5 },
        ],
      }],
      { obstacleClearanceM: 1 },
    );
    const result = generateSolarLayout({
      roof,
      panel,
      constraints: { edgeGapM: 0.2, panelGapM: 0.1, allowedRotations: [0, 90] },
      usableRoofRegions: [region],
    });

    const area = usableArea(region);
    const panelFootprintArea = result.placements.length * panel.widthM * panel.lengthM;
    const utilization = panelFootprintArea / area;

    expect(area).toBeGreaterThan(0);
    expect(utilization).toBeGreaterThanOrEqual(0);
    expect(utilization).toBeLessThanOrEqual(1);
    expect(result.placements.every((placement) => placement.center.x < 3 || placement.center.x > 7)).toBe(true);
  });

  it("keeps capacity monotonic under a larger edge setback", () => {
    const lowSetback = generateSolarLayout({
      roof,
      panel,
      constraints: { edgeGapM: 0.2, panelGapM: 0.1, allowedRotations: [0, 90] },
    });
    const highSetback = generateSolarLayout({
      roof,
      panel,
      constraints: { edgeGapM: 1, panelGapM: 0.1, allowedRotations: [0, 90] },
    });

    expect(highSetback.placements.length).toBeLessThanOrEqual(lowSetback.placements.length);
    expect(highSetback.dcCapacityWatts).toBeLessThanOrEqual(lowSetback.dcCapacityWatts);
  });
});
