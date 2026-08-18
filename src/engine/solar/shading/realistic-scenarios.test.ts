import { describe, expect, it } from "vitest";
import { estimateAnnualSolarProduction } from "./annual-production";
import type { RoofObstaclePrism } from "./occlusion";
import type { PanelPlacement } from "@/engine/solar/placement";
import type { SolarPanelSpec } from "@/engine/solar/panel";
import type { RoofPlane } from "@/engine/solar/layout/roof-planes";

const panel: SolarPanelSpec = {
  id: "realistic-panel",
  manufacturer: "Reference",
  model: "400W",
  widthM: 1,
  lengthM: 2,
  powerWatts: 400,
  efficiency: 0.2,
};

const placement: PanelPlacement = {
  id: "panel-1",
  panelId: panel.id,
  center: { x: 5, y: 5 },
  rotation: 0,
};

const roof: RoofPlane = {
  id: "south-roof",
  polygon: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ],
  pitchDeg: 25,
  azimuthDeg: 180,
};

const fullRoofBuilding: RoofObstaclePrism = {
  id: "adjacent-building",
  footprint: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ],
  minZM: 0,
  maxZM: 8,
};

function request(overrides: Partial<Parameters<typeof estimateAnnualSolarProduction>[0]> = {}) {
  return {
    startDate: new Date("2025-06-01T00:00:00.000Z"),
    endDate: new Date("2025-09-01T00:00:00.000Z"),
    timestepMinutes: 60,
    latitudeDeg: 34.05,
    longitudeDeg: -118.25,
    panel,
    placements: [placement],
    roofPlanes: [roof],
    ...overrides,
  };
}

describe("realistic annual production scenarios", () => {
  it("produces positive summer energy on an unobstructed south-facing roof", () => {
    const result = estimateAnnualSolarProduction(request());

    expect(result.totalDcEnergyKWh).toBeGreaterThan(0);
    expect(result.peakDcPowerWatts).toBeGreaterThan(0);
    expect(result.producingIntervals).toBeGreaterThan(0);
    expect(result.monthly.every((month) => month.dcEnergyWh >= 0)).toBe(true);
  });

  it("reduces production when a tall structure blocks the panel", () => {
    const unshaded = estimateAnnualSolarProduction(request());
    const shaded = estimateAnnualSolarProduction(request({ obstacles: [fullRoofBuilding] }));

    expect(shaded.totalDcEnergyKWh).toBeLessThan(unshaded.totalDcEnergyKWh);
    expect(shaded.shadingLossKWh).toBeGreaterThan(0);
    expect(shaded.shadingLossPercent).toBeGreaterThan(0);
    expect(shaded.monthly.some((month) => month.shadedIntervals > 0)).toBe(true);
  });

  it("keeps annual results deterministic for repeated residential simulations", () => {
    const first = estimateAnnualSolarProduction(request({
      startDate: new Date("2025-01-01T00:00:00.000Z"),
      endDate: new Date("2026-01-01T00:00:00.000Z"),
      timestepMinutes: 180,
    }));
    const second = estimateAnnualSolarProduction(request({
      startDate: new Date("2025-01-01T00:00:00.000Z"),
      endDate: new Date("2026-01-01T00:00:00.000Z"),
      timestepMinutes: 180,
    }));

    expect(second).toEqual(first);
    expect(first.monthly).toHaveLength(12);
    expect(first.totalDcEnergyKWh).toBeGreaterThan(0);
  });
});
