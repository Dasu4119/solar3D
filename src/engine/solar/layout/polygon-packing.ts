import type { Point } from "@/engine/geometry/point";

export interface XInterval { minX: number; maxX: number }

function horizontalIntersections(polygon: Point[], y: number): number[] {
  const xs: number[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    if (a.y === b.y) continue;
    const crosses = (a.y <= y && y < b.y) || (b.y <= y && y < a.y);
    if (crosses) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
  }
  return xs.sort((a, b) => a - b);
}

export function horizontalIntervals(polygon: Point[], y: number): XInterval[] {
  const xs = horizontalIntersections(polygon, y);
  const intervals: XInterval[] = [];
  for (let i = 0; i + 1 < xs.length; i += 2) {
    if (xs[i + 1] > xs[i]) intervals.push({ minX: xs[i], maxX: xs[i + 1] });
  }
  return intervals;
}

export function commonHorizontalIntervals(polygon: Point[], yMin: number, yMax: number): XInterval[] {
  const low = horizontalIntervals(polygon, yMin);
  const high = horizontalIntervals(polygon, yMax);
  const result: XInterval[] = [];
  for (const a of low) {
    for (const b of high) {
      const minX = Math.max(a.minX, b.minX);
      const maxX = Math.min(a.maxX, b.maxX);
      if (maxX > minX) result.push({ minX, maxX });
    }
  }
  return result.sort((a, b) => a.minX - b.minX);
}

export function polygonBounds(points: Point[]) {
  return points.reduce((b, p) => ({
    minX: Math.min(b.minX, p.x), maxX: Math.max(b.maxX, p.x),
    minY: Math.min(b.minY, p.y), maxY: Math.max(b.maxY, p.y),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
}
