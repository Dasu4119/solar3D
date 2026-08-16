import type { Point } from "@/engine/geometry/point";
import type { LayoutObstacle } from "./types";

const EPSILON = 1e-9;

type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

function bounds(points: Point[]): Bounds {
  return points.reduce((b, p) => ({
    minX: Math.min(b.minX, p.x), maxX: Math.max(b.maxX, p.x),
    minY: Math.min(b.minY, p.y), maxY: Math.max(b.maxY, p.y),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
}

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    const onEdge = Math.abs(cross) <= EPSILON &&
      point.x >= Math.min(a.x, b.x) - EPSILON && point.x <= Math.max(a.x, b.x) + EPSILON &&
      point.y >= Math.min(a.y, b.y) - EPSILON && point.y <= Math.max(a.y, b.y) + EPSILON;
    if (onEdge) return true;
    if ((a.y > point.y) !== (b.y > point.y)) {
      const x = (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x;
      if (point.x < x) inside = !inside;
    }
  }
  return inside;
}

function orientation(a: Point, b: Point, c: Point): number {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) <= EPSILON) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a: Point, b: Point, c: Point): boolean {
  return b.x >= Math.min(a.x, c.x) - EPSILON && b.x <= Math.max(a.x, c.x) + EPSILON &&
    b.y >= Math.min(a.y, c.y) - EPSILON && b.y <= Math.max(a.y, c.y) + EPSILON;
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  return (o1 === 0 && onSegment(a, c, b)) || (o2 === 0 && onSegment(a, d, b)) ||
    (o3 === 0 && onSegment(c, a, d)) || (o4 === 0 && onSegment(c, b, d));
}

function polygonsIntersect(a: Point[], b: Point[]): boolean {
  if (!a.length || !b.length) return false;
  const ba = bounds(a);
  const bb = bounds(b);
  if (ba.maxX < bb.minX || bb.maxX < ba.minX || ba.maxY < bb.minY || bb.maxY < ba.minY) return false;
  for (let i = 0; i < a.length; i++) {
    const a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      if (segmentsIntersect(a[i], a2, b[j], b[(j + 1) % b.length])) return true;
    }
  }
  return pointInPolygon(a[0], b) || pointInPolygon(b[0], a);
}

function expandObstacle(obstacle: LayoutObstacle): Point[] {
  const clearance = obstacle.clearanceM ?? 0;
  if (clearance <= 0) return obstacle.polygon;
  const b = bounds(obstacle.polygon);
  return [
    { x: b.minX - clearance, y: b.minY - clearance },
    { x: b.maxX + clearance, y: b.minY - clearance },
    { x: b.maxX + clearance, y: b.maxY + clearance },
    { x: b.minX - clearance, y: b.maxY + clearance },
  ];
}

export function panelFootprint(center: Point, width: number, length: number, rotation: number): Point[] {
  const rotated = Math.abs(rotation % 180) === 90;
  const halfW = (rotated ? length : width) / 2;
  const halfL = (rotated ? width : length) / 2;
  return [
    { x: center.x - halfW, y: center.y - halfL },
    { x: center.x + halfW, y: center.y - halfL },
    { x: center.x + halfW, y: center.y + halfL },
    { x: center.x - halfW, y: center.y + halfL },
  ];
}

export function findBlockingObstacle(
  footprint: Point[],
  obstacles: LayoutObstacle[] = [],
): LayoutObstacle | undefined {
  return obstacles.find((obstacle) => polygonsIntersect(footprint, expandObstacle(obstacle)));
}
