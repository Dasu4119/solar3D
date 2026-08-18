import { describe, expect, it } from "vitest";
import type { SolarPanelSpec } from "@/engine/solar/panel";
import type { PanelPlacement } from "@/engine/solar/placement";
import type { RoofPlane } from "@/engine/solar/layout/roof-planes";
import { calculatePanelShadeFraction } from "../occlusion";

const panel: SolarPanelSpec = {
  id: "panel-1",
  manufacturer: "Test",
  model: "P1",
  widthM: 2,
  lengthM: 4,
  powerWatts: 400,
  efficiency: 0.2,
};

const placement: PanelPlacement = {
  id: "placement-1",
  panelId: panel.id,
  center: { x: 5, y: 5 },
  rotation: 0,
};

const plane: RoofPlane = {
  id: "roof-1",
  polygon: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ],
  pitchDeg: 0,
  azimuthDeg: 180,
};

describe("3D solar occlusion", () => {
  it("returns zero shade without an occluder", () => {
    expect(calculatePanelShadeFraction(panel, placement, plane, { x: 0, y: 1, z: 1 }, [])).toBe(0);
  });

  it("detects a full-width vertical obstruction in the sun path", () => {
    const obstacle = {
      id: "chimney",
      footprint: [
        { x: 0, y: 6 },
        { x: 10, y: 6 },
        { x: 10, y: 8 },
        { x: 0, y: 8 },
      ],
      minZM: 0,
      maxZM: 3,
    };

    expect(
      calculatePanelShadeFraction(panel, placement, plane, { x: 0, y: 1, z: 1 }, [obstacle]),
    ).toBe(1);
  });

  it("returns a deterministic partial shade fraction for a narrow obstruction", () => {
    const obstacle = {
      id: "vent",
      footprint: [
        { x: 4, y: 6 },
        { x: 6, y: 6 },
        { x: 6, y: 8 },
        { x: 4, y: 8 },
      ],
      minZM: 0,
      maxZM: 3,
    };

    const sun = { x: 0, y: 1, z: 1 };
    const first = calculatePanelShadeFraction(panel, placement, plane, sun, [obstacle], { samplesX: 8, samplesY: 8 });
    const second = calculatePanelShadeFraction(panel, placement, plane, sun, [obstacle], { samplesX: 8, samplesY: 8 });

    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(1);
    expect(first).toBe(second);
  });

  it("does not count an obstruction behind the panel relative to the sun", () => {
    const obstacle = {
      id: "behind",
      footprint: [
        { x: 0, y: 1 },
        { x: 10, y: 1 },
        { x: 10, y: 2 },
        { x: 0, y: 2 },
      ],
      minZM: 0,
      maxZM: 3,
    };

    expect(calculatePanelShadeFraction(panel, placement, plane, { x: 0, y: 1, z: 1 }, [obstacle])).toBe(0);
  });

  it("treats a sun below the horizon as fully unavailable", () => {
    expect(calculatePanelShadeFraction(panel, placement, plane, { x: 0, y: 1, z: -0.1 }, [])).toBe(1);
  });
});
