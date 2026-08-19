import { describe, expect, it } from "vitest";
import { buildUsableRoofRegion } from "@/engine/geometry/roof-constraints";
import type { SolarPanelSpec } from "@/engine/solar/panel";
import { generateLayoutCandidates } from "../generator";

const panel: SolarPanelSpec = {
  id: "panel-1",
  manufacturer: "Test",
  model: "P1",
  widthM: 1,
  lengthM: 2,
  powerWatts: 400,
  efficiency: 0.2,
};

describe("canonical roof constraints in layout generation", () => {
  it("rejects candidates inside obstacle clearance", () => {
    const region = buildUsableRoofRegion([
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }, { x: 0, y: 6 },
    ], [{
      id: "chimney-1", type: "chimney",
      footprint: [{ x: 4, y: 2 }, { x: 6, y: 2 }, { x: 6, y: 4 }, { x: 4, y: 4 }],
    }], { obstacleClearanceM: 1 });

    const candidates = generateLayoutCandidates(region.roof, panel, { allowedRotations: [0] }, [], undefined, undefined, [region]);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((candidate) => candidate.valid || candidate.score === -Infinity)).toBe(true);
    expect(candidates.some((candidate) => candidate.valid && candidate.placement.center.x > 3 && candidate.placement.center.x < 7)).toBe(false);
  });

  it("enforces setback against a non-axis-aligned roof edge", () => {
    const region = buildUsableRoofRegion([
      { x: 0, y: 0 }, { x: 8, y: 0 }, { x: 10, y: 5 }, { x: 2, y: 7 },
    ], [], { edgeM: 1 });
    const candidates = generateLayoutCandidates(region.roof, panel, { allowedRotations: [0] }, [], undefined, undefined, [region]);
    expect(candidates.some((candidate) => candidate.valid)).toBe(true);
    expect(candidates.every((candidate) => candidate.valid || candidate.score === -Infinity)).toBe(true);
  });
});
