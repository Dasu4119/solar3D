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

  it("selects the rotation with the highest estimated annual production", () => {
    const compactRoof: Point[] = [
      { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 3 }, { x: 0, y: 3 },
    ];
    const result = generateSolarLayout({
      roof: compactRoof,
      panel,
      roofPlanes: [{ id: "south", polygon: compactRoof, pitchDeg: 30, azimuthDeg: 0 }],
      constraints: { edgeGapM: 0, panelGapM: 0, allowedRotations: [0, 90] },
      productionObjective: {
        preferredAzimuthDeg: 90,
        preferredPitchDeg: 30,
        annualSpecificYieldKwhPerKwp: 1400,
        performanceRatio: 0.82,
      },
    });

    expect(result.placements.length).toBeGreaterThan(0);
    expect(result.placements.every((placement) => placement.rotation === 90)).toBe(true);
    expect(result.estimatedAnnualKwh).toBeGreaterThan(0);
    expect(result.score).toBe(result.estimatedAnnualKwh);
  });
});
