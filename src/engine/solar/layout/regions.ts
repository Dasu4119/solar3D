import type { Point } from "@/engine/geometry/point";

export interface RoofRegion {
  outer: Point[];
  holes?: Point[][];
}

function cross(a: Point, b: Point, c: Point) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function pointOnSegment(p: Point, a: Point, b: Point) {
  return Math.abs(cross(a, b, p)) < 1e-9 && p.x >= Math.min(a.x, b.x) - 1e-9 && p.x <= Math.max(a.x, b.x) + 1e-9 && p.y >= Math.min(a.y, b.y) - 1e-9 && p.y <= Math.max(a.y, b.y) + 1e-9;
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if (pointOnSegment(point, a, b)) return true;
    if ((a.y > point.y) !== (b.y > point.y)) {
      const x = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
      if (point.x < x) inside = !inside;
    }
  }
  return inside;
}

export function pointInRoofRegion(point: Point, region: RoofRegion): boolean {
  if (!pointInPolygon(point, region.outer)) return false;
  return !(region.holes ?? []).some((hole) => pointInPolygon(point, hole));
}

export function normalizeRoofRegions(outer: Point[], holes: Point[][] = []): RoofRegion[] {
  if (outer.length < 3) return [];
  return [{ outer, holes: holes.filter((hole) => hole.length >= 3) }];
}

export function isRegionUsable(region: RoofRegion): boolean {
  return region.outer.length >= 3 && (region.holes ?? []).every((hole) => hole.length >= 3);
}
