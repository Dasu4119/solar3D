import { describe, expect, it } from "vitest";
import { normalizeRoofRegions, pointInRoofRegion } from "../regions";

describe("roof regions", () => {
  const outer = [
    { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
  ];
  const hole = [
    { x: 4, y: 4 }, { x: 6, y: 4 }, { x: 6, y: 6 }, { x: 4, y: 6 },
  ];

  it("accepts points in the roof and rejects points in a hole", () => {
    const [region] = normalizeRoofRegions(outer, [hole]);
    expect(pointInRoofRegion({ x: 2, y: 2 }, region)).toBe(true);
    expect(pointInRoofRegion({ x: 5, y: 5 }, region)).toBe(false);
  });

  it("normalizes invalid holes away", () => {
    const [region] = normalizeRoofRegions(outer, [[{ x: 0, y: 0 }]]);
    expect(region.holes).toEqual([]);
  });
});
