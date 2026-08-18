import { describe, expect, it } from "vitest";
import { estimateAnnualSolarProduction } from "./annual-production";
import type { PanelPlacement } from "@/engine/solar/placement";
import type { SolarPanelSpec } from "@/engine/solar/panel";
import type { RoofPlane } from "@/engine/solar/layout/roof-planes";

const panel: SolarPanelSpec = {
  id: "test-panel",
  manufacturer: "Test",
  model: "P1",
  widthM: 1,
  lengthM: 2,
  powerWatts: 400,
  efficiency: 0.2,
};

const placements: PanelPlacement[] = [
  { id: "placement-1", panelId: panel.id, center: { x: 5, y: 5 }, rotation: 0 },
];

const roofPlanes: RoofPlane[] = [
  {
    id: "roof-1",
    polygon: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
    pitchDeg: 25,
    azimuthDeg: 180,
  },
];

describe("estimateAnnualSolarProduction", () => {
  it("simulates a complete non-leap year with deterministic interval counts", () => {
    const result = estimateAnnualSolarProduction({
      startDate: new Date("2025-01-01T00:00:00.000Z"),
      endDate: new Date("2026-01-01T00:00:00.000Z"),
      timestepMinutes: 360,
      latitudeDeg: 34.05,
      longitudeDeg: -118.25,
      panel,
      placements,
      roofPlanes,
    });

    expect(result.simulatedIntervals).toBe(1460);
    expect(result.monthly).toHaveLength(12);
    expect(result.totalDcEnergyKWh).toBeGreaterThan(0);
    expect(result.unshadedDcEnergyKWh).toBeGreaterThan(0);
    expect(result.peakDcPowerWatts).toBeGreaterThan(0);
    expect(result.producingIntervals).toBeGreaterThan(0);
    expect(result.shadingLossKWh).toBeGreaterThanOrEqual(0);
    expect(result.shadingLossPercent).toBeGreaterThanOrEqual(0);
  });

  it("is deterministic for identical inputs", () => {
    const request = {
      startDate: new Date("2025-06-01T00:00:00.000Z"),
      endDate: new Date("2025-06-08T00:00:00.000Z"),
      timestepMinutes: 60,
      latitudeDeg: 34.05,
      longitudeDeg: -118.25,
      panel,
      placements,
      roofPlanes,
    };

    const first = estimateAnnualSolarProduction(request);
    const second = estimateAnnualSolarProduction(request);

    expect(second).toEqual(first);
  });

  it("rejects invalid time ranges and unsafe timestep sizes", () => {
    expect(() => estimateAnnualSolarProduction({
      startDate: new Date("2025-01-02T00:00:00.000Z"),
      endDate: new Date("2025-01-01T00:00:00.000Z"),
      latitudeDeg: 0,
      longitudeDeg: 0,
      panel,
      placements,
      roofPlanes,
    })).toThrow("endDate must be after startDate");

    expect(() => estimateAnnualSolarProduction({
      startDate: new Date("2025-01-01T00:00:00.000Z"),
      endDate: new Date("2025-01-02T00:00:00.000Z"),
      timestepMinutes: 1,
      latitudeDeg: 0,
      longitudeDeg: 0,
      panel,
      placements,
      roofPlanes,
    })).toThrow("timestepMinutes");
  });
});
