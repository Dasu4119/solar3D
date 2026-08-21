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

function polygonSignedArea(polygon: Polygon2D): number {
  let area = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const next = (index + 1) % polygon.length;
    area += polygon[index].x * polygon[next].y - polygon[next].x * polygon[index].y;
  }
  return area / 2;
}

function lineIntersection(firstStart: Point2D, firstEnd: Point2D, secondStart: Point2D, secondEnd: Point2D): Point2D | null {
  const firstDx = firstEnd.x - firstStart.x;
  const firstDy = firstEnd.y - firstStart.y;
  const secondDx = secondEnd.x - secondStart.x;
  const secondDy = secondEnd.y - secondStart.y;
  const denominator = firstDx * secondDy - firstDy * secondDx;
  if (Math.abs(denominator) <= EPSILON) return null;
  const offsetX = secondStart.x - firstStart.x;
  const offsetY = secondStart.y - firstStart.y;
  const t = (offsetX * secondDy - offsetY * secondDx) / denominator;
  return { x: firstStart.x + t * firstDx, y: firstStart.y + t * firstDy };
}

/**
 * Inset a simple polygon by a metric distance, independent of its rotation.
 * Each edge is translated inward and adjacent translated lines are intersected.
 */
export function insetPolygon(polygon: Polygon2D, setbackM: number): Polygon2D {
  if (polygon.length < 3 || setbackM <= EPSILON) return [...polygon];
  const area = polygonSignedArea(polygon);
  if (Math.abs(area) <= EPSILON) return [];
  const ccw = area > 0;
  const edges = polygon.map((start, index) => {
    const end = polygon[(index + 1) % polygon.length];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length <= EPSILON) return null;
    const inward = ccw ? { x: -dy / length, y: dx / length } : { x: dy / length, y: -dx / length };
    const offset = { x: inward.x * setbackM, y: inward.y * setbackM };
    return {
      start: { x: start.x + offset.x, y: start.y + offset.y },
      end: { x: end.x + offset.x, y: end.y + offset.y },
    };
  });
  if (edges.some((edge) => edge === null)) return [];

  const result: Polygon2D = [];
  for (let index = 0; index < edges.length; index += 1) {
    const previous = edges[(index - 1 + edges.length) % edges.length]!;
    const current = edges[index]!;
    const intersection = lineIntersection(previous.start, previous.end, current.start, current.end);
    if (!intersection) return [];
    result.push(intersection);
  }

  if (result.length < 3 || Math.abs(polygonSignedArea(result)) <= EPSILON) return [];
  return result.every((point) => pointInPolygon(point, polygon)) ? result : [];
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
  const usableRoof = region.edgeSetbackM > 0 ? insetPolygon(region.roof, region.edgeSetbackM) : region.roof;
  if (usableRoof.length < 3 || !pointInPolygon(point, usableRoof)) return false;
  return !region.exclusions.some((exclusion) => pointInPolygon(point, exclusion.polygon)
    || (exclusion.clearanceM > 0 && distanceToPolygon(point, exclusion.polygon) < exclusion.clearanceM - EPSILON));
}

export function isPolygonUsable(polygon: Polygon2D, region: UsableRoofRegion): boolean {
  if (polygon.length < 3) return false;
  const usableRoof = region.edgeSetbackM > 0 ? insetPolygon(region.roof, region.edgeSetbackM) : region.roof;
  if (usableRoof.length < 3 || !polygon.every((point) => isPointUsable(point, region))) return false;
  if (polygonEdgesIntersect(polygon, usableRoof)) return false;
  if (!polygonContainsPolygon(usableRoof, polygon)) return false;
  return !region.exclusions.some((exclusion) => polygonEdgesIntersect(polygon, exclusion.polygon)
    || polygonContainsPolygon(polygon, exclusion.polygon)
    || polygonBoundaryDistance(polygon, exclusion.polygon) < exclusion.clearanceM - EPSILON);
}

export function hasUsableArea(region: UsableRoofRegion): boolean {
  return (region.edgeSetbackM > 0 ? insetPolygon(region.roof, region.edgeSetbackM) : region.roof).length >= 3;
}

export { EPSILON };
