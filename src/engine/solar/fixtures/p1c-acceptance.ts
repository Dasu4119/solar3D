import type { RoofMesh } from "@/engine/roof/plane-extraction";
import type { RoofObstacle } from "@/engine/geometry/roof-constraints";
import type { SolarPanelSpec } from "@/engine/solar/panel";

/**
 * Deterministic two-plane gable roof used by the P1-C acceptance test.
 * Each roof plane is represented by two triangles with intentionally mixed
 * winding so canonical normalisation is exercised.
 */
export const P1C_ROOF_MESH: RoofMesh = {
  vertices: [
    { x: 0, y: 0, z: 0 },
    { x: 5, y: 0, z: 2 },
    { x: 5, y: 10, z: 2 },
    { x: 0, y: 10, z: 0 },
    { x: 10, y: 0, z: 0 },
    { x: 10, y: 10, z: 0 },
  ],
  triangles: [
    { a: 0, b: 1, c: 2 },
    { a: 2, b: 3, c: 0 },
    { a: 4, b: 2, c: 1 },
    { a: 5, b: 2, c: 4 },
  ],
};

export const P1C_ROOF_REGIONS = [
  [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 5, y: 10 },
    { x: 0, y: 10 },
  ],
  [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 5, y: 10 },
    { x: 0, y: 10 },
  ],
];

export const P1C_OBSTACLES: RoofObstacle[] = [
  {
    id: "p1c-chimney",
    type: "chimney",
    footprint: [
      { x: 2, y: 4 },
      { x: 3, y: 4 },
      { x: 3, y: 6 },
      { x: 2, y: 6 },
    ],
    heightM: 1.2,
  },
];

export const P1C_PANEL: SolarPanelSpec = {
  id: "p1c-400w",
  manufacturer: "Solar3D",
  model: "P1-C Reference 400W",
  widthM: 1,
  lengthM: 2,
  powerWatts: 400,
  efficiency: 0.2,
};

export const P1C_PRODUCTION_INPUT = {
  performanceRatio: 0.82,
  annualSpecificYieldKwhPerKwp: 1400,
  shadedEnergyFraction: 0.05,
} as const;
