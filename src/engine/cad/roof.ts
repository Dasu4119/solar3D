import type { Point } from "@/engine/geometry/point";
import { polygonArea } from "@/engine/cad/measure";

export function isClosedRoof(points: Point[]): boolean {
  return points.length >= 3;
}

export function roofAreaM2(points: Point[], unitsPerMeter = 100): number {
  if (!isClosedRoof(points) || unitsPerMeter <= 0) return 0;
  return polygonArea(points) / (unitsPerMeter * unitsPerMeter);
}

export function moveVertex(points: Point[], index: number, point: Point): Point[] {
  if (index < 0 || index >= points.length) return points;
  return points.map((current, i) => (i === index ? point : current));
}

export function removeVertex(points: Point[], index: number): Point[] {
  if (index < 0 || index >= points.length || points.length <= 3) return points;
  return points.filter((_, i) => i !== index);
}
