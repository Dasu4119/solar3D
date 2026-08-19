import type { Point2D, Polygon2D } from "@/engine/geometry/types";
import { pointInPolygon } from "@/engine/geometry/types";

export type RoofObstacleType =
  | "chimney" | "skylight" | "vent" | "hvac" | "tree" | "building" | "custom";

export interface RoofObstacle {
  id: string;
  type: RoofObstacleType;
  footprint: Polygon2D;
  heightM?: number;
  roofPlaneId?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface RoofSetbackRules {
  edgeM?: number;
  obstacleClearanceM?: number;
}

export interface RoofExclusionZone {
  source: "edge" | "obstacle";
  sourceId: string;
  polygon: Polygon2D;
  clearanceM: number;
}

export interface UsableRoofRegion {
  roof: Polygon2D;
  exclusions: RoofExclusionZone[];
  edgeSetbackM: number;
}

const EPSILON = 1e-9;

function distanceSquared(a: Point2D, b: Point2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function distanceToSegmentSquared(point: Point2D, start: Point2D, end: Point2D): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= EPSILON) return distanceSquared(point, start);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return distanceSquared(point, { x: start.x + t * dx, y: start.y + t * dy });
}

function distanceToPolygon(point: Point2D, polygon: Polygon2D): number {
  if (polygon.length < 2) return Infinity;
  let minimum = Infinity;
  for (let index = 0; index < polygon.length; index += 1) {
    const next = (index + 1) % polygon.length;
    minimum = Math.min(minimum, distanceToSegmentSquared(point, polygon[index], polygon[next]));
  }
  return Math.sqrt(minimum);
}

function orientation(a: Point2D, b: Point2D, c: Point2D): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a: Point2D, b: Point2D, point: Point2D): boolean {
  return point.x >= Math.min(a.x, b.x) - EPSILON
    && point.x <= Math.max(a.x, b.x) + EPSILON
    && point.y >= Math.min(a.y, b.y) - EPSILON
    && point.y <= Math.max(a.y, b.y) + EPSILON;
}

function segmentsIntersect(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (((o1 > EPSILON && o2 < -EPSILON) || (o1 < -EPSILON && o2 > EPSILON))
    && ((o3 > EPSILON && o4 < -EPSILON) || (o3 < -EPSILON && o4 > EPSILON))) return true;
  return (Math.abs(o1) <= EPSILON && onSegment(a, b, c))
    || (Math.abs(o2) <= EPSILON && onSegment(a, b, d))
    || (Math.abs(o3) <= EPSILON && onSegment(c, d, a))
    || (Math.abs(o4) <= EPSILON && onSegment(c, d, b));
}

function segmentDistanceSquared(a: Point2D, b: Point2D, c: Point2D, d: Point2D): number {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(distanceToSegmentSquared(a, c, d), distanceToSegmentSquared(b, c, d), distanceToSegmentSquared(c, a, b), distanceToSegmentSquared(d, a, b));
}

function polygonEdgesIntersect(first: Polygon2D, second: Polygon2D): boolean {
  for (let firstIndex = 0; firstIndex < first.length; firstIndex += 1) {
    const firstNext = (firstIndex + 1) % first.length;
    for (let secondIndex = 0; secondIndex < second.length; secondIndex += 1) {
      const secondNext = (secondIndex + 1) % second.length;
      if (segmentsIntersect(first[firstIndex], first[firstNext], second[secondIndex], second[secondNext])) return true;
    }
  }
  return false;
}

function polygonBoundaryDistance(first: Polygon2D, second: Polygon2D): number {
  let minimum = Infinity;
  for (let firstIndex = 0; firstIndex < first.length; firstIndex += 1) {
    const firstNext = (firstIndex + 1) % first.length;
    for (let secondIndex = 0; secondIndex < second.length; secondIndex += 1) {
      const secondNext = (secondIndex + 1) % second.length;
      minimum = Math.min(minimum, Math.sqrt(segmentDistanceSquared(first[firstIndex], first[firstNext], second[secondIndex], second[secondNext])));
    }
  }
  return minimum;
}

function polygonContainsPolygon(container: Polygon2D, candidate: Polygon2D): boolean {
  return candidate.every((point) => pointInPolygon(point, container));
}

export function buildRoofExclusions(_roof: Polygon2D, obstacles: RoofObstacle[], rules: RoofSetbackRules = {}): RoofExclusionZone[] {
  const clearance = Math.max(0, rules.obstacleClearanceM ?? 0);
  return obstacles.filter((obstacle) => obstacle.footprint.length >= 3).map((obstacle) => ({
    source: "obstacle" as const, sourceId: obstacle.id, polygon: [...obstacle.footprint], clearanceM: clearance,
  }));
}

export function buildUsableRoofRegion(roof: Polygon2D, obstacles: RoofObstacle[] = [], rules: RoofSetbackRules = {}): UsableRoofRegion {
  if (roof.length < 3) return { roof: [], exclusions: [], edgeSetbackM: 0 };
  return { roof: [...roof], exclusions: buildRoofExclusions(roof, obstacles, rules), edgeSetbackM: Math.max(0, rules.edgeM ?? 0) };
}

export function isPointUsable(point: Point2D, region: UsableRoofRegion): boolean {
  if (region.roof.length < 3 || !pointInPolygon(point, region.roof)) return false;
  if (region.edgeSetbackM > 0 && distanceToPolygon(point, region.roof) < region.edgeSetbackM - EPSILON) return false;
  return !region.exclusions.some((exclusion) => pointInPolygon(point, exclusion.polygon)
    || (exclusion.clearanceM > 0 && distanceToPolygon(point, exclusion.polygon) < exclusion.clearanceM - EPSILON));
}

export function isPolygonUsable(polygon: Polygon2D, region: UsableRoofRegion): boolean {
  if (polygon.length < 3 || !polygon.every((point) => isPointUsable(point, region))) return false;
  if (polygonEdgesIntersect(polygon, region.roof)) return false;
  if (polygonBoundaryDistance(polygon, region.roof) < region.edgeSetbackM - EPSILON) return false;
  if (!polygonContainsPolygon(region.roof, polygon)) return false;
  return !region.exclusions.some((exclusion) => polygonEdgesIntersect(polygon, exclusion.polygon)
    || polygonContainsPolygon(polygon, exclusion.polygon)
    || polygonBoundaryDistance(polygon, exclusion.polygon) < exclusion.clearanceM - EPSILON);
}

export function hasUsableArea(region: UsableRoofRegion): boolean {
  return region.roof.length >= 3;
}

export { EPSILON };
