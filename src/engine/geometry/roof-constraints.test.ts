import { describe, expect, it } from "vitest";
import {
  buildUsableRoofRegion,
  insetPolygon,
  isPointUsable,
  isPolygonUsable,
} from "./roof-constraints";

type Point = { x: number; y: number };

function area(polygon: Point[]): number {
  let sum = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const next = (i + 1) % polygon.length;
    sum += polygon[i].x * polygon[next].y - polygon[next].x * polygon[i].y;
  }
  return Math.abs(sum) / 2;
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
  ));
  const x = start.x + t * dx;
  const y = start.y + t * dy;
  return Math.hypot(point.x - x, point.y - y);
}

describe("roof edge setback", () => {
  const rotatedRoof = [
    { x: 0, y: 0 },
    { x: 8, y: 2 },
    { x: 7, y: 8 },
    { x: -1, y: 6 },
  ];

  it("uses a true metric inset for non-axis-aligned roofs", () => {
    const inset = insetPolygon(rotatedRoof, 1);

    expect(inset).toHaveLength(rotatedRoof.length);
    expect(area(inset)).toBeLessThan(area(rotatedRoof));

    // Each inset vertex is one metre from both adjacent source edges.
    inset.forEach((point, index) => {
      const previous = rotatedRoof[(index - 1 + rotatedRoof.length) % rotatedRoof.length];
      const current = rotatedRoof[index];
      expect(distanceToSegment(point, previous, current)).toBeCloseTo(1, 6);
    });
  });

  it("rejects points and panel footprints inside the edge setback", () => {
    const region = buildUsableRoofRegion(rotatedRoof, [], { edgeM: 1 });

    expect(isPointUsable({ x: 3, y: 4 }, region)).toBe(true);
    expect(isPointUsable({ x: 0.1, y: 0.1 }, region)).toBe(false);
    expect(isPolygonUsable([
      { x: 0.1, y: 0.1 },
      { x: 1.1, y: 0.35 },
      { x: 1.1, y: 0.85 },
      { x: 0.1, y: 0.6 },
    ], region)).toBe(false);
  });

  it("keeps obstacle clearance independent from the roof inset", () => {
    const region = buildUsableRoofRegion(rotatedRoof, [
      {
        id: "chimney-1",
        type: "chimney",
        footprint: [
          { x: 3, y: 3 },
          { x: 4, y: 3 },
          { x: 4, y: 4 },
          { x: 3, y: 4 },
        ],
      },
    ], { edgeM: 1, obstacleClearanceM: 1 });

    expect(isPointUsable({ x: 2, y: 2 }, region)).toBe(true);
    expect(isPointUsable({ x: 3.5, y: 3.5 }, region)).toBe(false);
  });
});
