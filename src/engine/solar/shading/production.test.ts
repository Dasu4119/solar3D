import { describe, expect, it } from "vitest";
import { estimateSolarProduction } from "./production";
import type { SolarPanelSpec } from "@/engine/solar/panel";
import type { PanelPlacement } from "@/engine/solar/placement";
import type { RoofPlane } from "@/engine/solar/layout/roof-planes";

const panel: SolarPanelSpec = {
  id: "panel-1",
  manufacturer: "Test",
  model: "400W",
  widthM: 1,
  lengthM: 2,
  powerWatts: 400,
  efficiency: 0.2,
};

const placement: PanelPlacement = {
  id: "placement-1",
  panelId: panel.id,
  center: { x: 0, y: 0 },
  rotation: 0,
};

const plane: RoofPlane = {
  id: "roof-1",
  polygon: [
    { x: -5, y: -5 },
    { x: 5, y: -5 },
    { x: 5, y: 5 },
    { x: -5, y: 5 },
  ],
  pitchDeg: 20,
  azimuthDeg: 180,
};

describe("estimateSolarProduction", () => {
  it("connects solar position, occlusion, irradiance and DC production", () => {
    const result = estimateSolarProduction({
      date: new Date("2026-03-20T12:00:00Z"),
      latitudeDeg: 0,
      longitudeDeg: 0,
      panel,
      placements: [placement],
      roofPlanes: [plane],
      irradiance: { directNormalWm2: 1000, diffuseHorizontalWm2: 0 },
    });

    expect(result.panels).toHaveLength(1);
    expect(result.panels[0].shadeFraction).toBe(0);
    expect(result.panels[0].estimatedDcPowerWatts).toBeGreaterThan(0);
    expect(result.panels[0].estimatedDcPowerWatts).toBeLessThanOrEqual(panel.powerWatts);
    expect(result.totalDcPowerWatts).toBe(result.panels[0].estimatedDcPowerWatts);
    expect(result.unshadedDcPowerWatts).toBeGreaterThanOrEqual(result.totalDcPowerWatts);
  });

  it("is deterministic for identical inputs", () => {
    const request = {
      date: new Date("2026-03-20T12:00:00Z"),
      latitudeDeg: 0,
      longitudeDeg: 0,
      panel,
      placements: [placement],
      roofPlanes: [plane],
    };

    expect(estimateSolarProduction(request)).toEqual(estimateSolarProduction(request));
  });

  it("returns zero production when the sun is below the horizon", () => {
    const result = estimateSolarProduction({
      date: new Date("2026-03-20T00:00:00Z"),
      latitudeDeg: 0,
      longitudeDeg: 0,
      panel,
      placements: [placement],
      roofPlanes: [plane],
    });

    expect(result.totalDcPowerWatts).toBe(0);
  });
});
