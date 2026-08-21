import { describe, expect, it } from "vitest";
import {
  buildUsableRoofRegion,
  insetPolygon,
  isPointUsable,
  isPolygonUsable,
} from "./roof-constraints";

describe("roof obstacle constraints", () => {
  const roof = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 8 },
    { x: 0, y: 8 },
  ];

  it("insets a rotated roof polygon by a true metric setback", () => {
    const rotatedRoof = [
      { x: 0, y: 0 },
      { x: 8, y: 2 },
      { x: 7, y: 8 },
      { x: -1, y: 6 },
    ];
    const inset = insetPolygon(rotatedRoof, 1);

    expect(inset).toHaveLength(4);
    expect(inset.every((point) => isPointUsable(point, buildUsableRoofRegion(rotatedRoof)))).toBe(true);
  });

  it("uses the inset polygon as the usable roof boundary", () => {
    const rotatedRoof = [
      { x: 0, y: 0 },
      { x: 8, y: 2 },
      { x: 7, y: 8 },
      { x: -1, y: 6 },
    ];
    const region = buildUsableRoofRegion(rotatedRoof, [], { edgeM: 1 });

    expect(region.roof).toHaveLength(4);
    expect(region.usableRoof).toHaveLength(4);
    expect(region.usableRoof).not.toEqual(region.roof);
    expect(isPointUsable({ x: 3, y: 4 }, region)).toBe(true);
    expect(isPointUsable({ x: 0.1, y: 0.1 }, region)).toBe(false);
    expect(isPolygonUsable([
      { x: 1.0, y: 0.6 },
      { x: 2.0, y: 0.85 },
      { x: 2.0, y: 1.3 },
      { x: 1.0, y: 1.05 },
    ], region)).toBe(false);
  });

  it("creates a deterministic exclusion zone for a chimney", () => {
    const region = buildUsableRoofRegion(roof, [
      {
        id: "chimney-1",
        type: "chimney",
        footprint: [
          { x: 4, y: 3 },
          { x: 5, y: 3 },
          { x: 5, y: 4 },
          { x: 4, y: 4 },
        ],
      },
    ], { obstacleClearanceM: 1 });

    expect(region.exclusions).toHaveLength(1);
    expect(region.exclusions[0].sourceId).toBe("chimney-1");
    expect(isPointUsable({ x: 2, y: 2 }, region)).toBe(true);
    expect(isPointUsable({ x: 4.5, y: 4.5 }, region)).toBe(false);
    expect(isPointUsable({ x: 3.5, y: 3.5 }, region)).toBe(false);
  });

  it("rejects a panel footprint crossing an obstacle clearance zone", () => {
    const region = buildUsableRoofRegion(roof, [
      {
        id: "skylight-1",
        type: "skylight",
        footprint: [
          { x: 6, y: 2 },
          { x: 7, y: 2 },
          { x: 7, y: 3 },
          { x: 6, y: 3 },
        ],
      },
    ], { obstacleClearanceM: 0.5 });

    expect(isPolygonUsable([
      { x: 5.7, y: 2.2 },
      { x: 6.4, y: 2.2 },
      { x: 6.4, y: 3.1 },
      { x: 5.7, y: 3.1 },
    ], region)).toBe(false);
  });

  it("rejects a panel whose edge enters obstacle clearance even when its vertices are clear", () => {
    const region = buildUsableRoofRegion(roof, [
      {
        id: "vent-1",
        type: "vent",
        footprint: [
          { x: 4.5, y: 3.5 },
          { x: 5.5, y: 3.5 },
          { x: 5.5, y: 4.5 },
          { x: 4.5, y: 4.5 },
        ],
      },
    ], { obstacleClearanceM: 0.5 });

    expect(isPolygonUsable([
      { x: 3.8, y: 3.0 },
      { x: 6.2, y: 3.0 },
      { x: 6.2, y: 3.2 },
      { x: 3.8, y: 3.2 },
    ], region)).toBe(false);
  });

  it("keeps unrelated roof area usable", () => {
    const region = buildUsableRoofRegion(roof, [
      {
        id: "hvac-1",
        type: "hvac",
        footprint: [
          { x: 8, y: 6 },
          { x: 9, y: 6 },
          { x: 9, y: 7 },
          { x: 8, y: 7 },
        ],
      },
    ], { obstacleClearanceM: 0.5 });

    expect(isPointUsable({ x: 1, y: 1 }, region)).toBe(true);
  });
});
