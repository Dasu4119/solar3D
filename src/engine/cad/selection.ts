import type { Point } from "@/engine/geometry/point";

export function nearestVertex(points: Point[], target: Point, tolerance: number): number {
  let best = -1;
  let bestDistance = tolerance;
  points.forEach((point, index) => {
    const distance = Math.hypot(point.x - target.x, point.y - target.y);
    if (distance <= bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

export function translatePolygon(points: Point[], dx: number, dy: number): Point[] {
  return points.map((point) => ({ x: point.x + dx, y: point.y + dy }));
}
