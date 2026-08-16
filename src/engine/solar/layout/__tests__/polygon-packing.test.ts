import { describe, expect, it } from "vitest";
import type { Point } from "@/engine/geometry/point";
import { commonHorizontalIntervals, horizontalIntervals } from "../polygon-packing";

describe("polygon-aware roof packing", () => {
  it("finds multiple usable intervals on a concave roof slice", () => {
    const roof: Point[] = [
      { x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 6 },
      { x: 4, y: 6 }, { x: 4, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 6 }, { x: 0, y: 6 },
    ];
    const intervals = horizontalIntervals(roof, 5);
    expect(intervals).toEqual([
      { minX: 0, maxX: 2 },
      { minX: 4, maxX: 6 },
    ]);
  });

  it("intersects scanlines to find space valid for the full panel height", () => {
    const roof: Point[] = [
      { x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 8 }, { x: 0, y: 8 },
    ];
    const intervals = commonHorizontalIntervals(roof, 2, 4);
    expect(intervals).toEqual([{ minX: 0, maxX: 8 }]);
  });
});
