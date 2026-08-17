import type { Point2D, Polygon2D } from "@/engine/geometry/types";
import { pointInPolygon } from "@/engine/geometry/types";

export type RoofObstacleType =
  | "chimney"
  | "skylight"
  | "vent"
  | "hvac"
  | "tree"
  | "building"
  | "custom";

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
}

export interface UsableRoofRegion {
  roof: Polygon2D;
  exclusions: RoofExclusionZone[];
}

const EPSILON = 1e-9;

function bounds(points: Polygon2D) {
  return points.reduce(
    (result, point) => ({
      minX: Math.min(result.minX, point.x),
      maxX: Math.max(result.maxX, point.x),
      minY: Math.min(result.minY, point.y),
      maxY: Math.max(result.maxY, point.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );
}

function expandBounds(points: Polygon2D, clearanceM: number): Polygon2D {
  const b = bounds(points);
  return [
    { x: b.minX - clearanceM, y: b.minY - clearanceM },
    { x: b.maxX + clearanceM, y: b.minY - clearanceM },
    { x: b.maxX + clearanceM, y: b.maxY + clearanceM },
    { x: b.minX - clearanceM, y: b.maxY + clearanceM },
  ];
}

export function buildRoofExclusions(
  roof: Polygon2D,
  obstacles: RoofObstacle[],
  rules: RoofSetbackRules = {},
): RoofExclusionZone[] {
  const clearance = Math.max(0, rules.obstacleClearanceM ?? 0);
  return obstacles
    .filter((obstacle) => obstacle.footprint.length >= 3)
    .map((obstacle) => ({
      source: "obstacle" as const,
      sourceId: obstacle.id,
      polygon: expandBounds(obstacle.footprint, clearance),
    }));
}

export function buildUsableRoofRegion(
  roof: Polygon2D,
  obstacles: RoofObstacle[] = [],
  rules: RoofSetbackRules = {},
): UsableRoofRegion {
  if (roof.length < 3) return { roof: [], exclusions: [] };

  const exclusions = buildRoofExclusions(roof, obstacles, rules);
  return { roof: [...roof], exclusions };
}

export function isPointUsable(point: Point2D, region: UsableRoofRegion): boolean {
  if (region.roof.length < 3 || !pointInPolygon(point, region.roof)) return false;
  return !region.exclusions.some((exclusion) => pointInPolygon(point, exclusion.polygon));
}

export function isPolygonUsable(polygon: Polygon2D, region: UsableRoofRegion): boolean {
  if (polygon.length < 3) return false;
  return polygon.every((point) => isPointUsable(point, region));
}

export function hasUsableArea(region: UsableRoofRegion): boolean {
  return region.roof.length >= 3 && region.exclusions.every((exclusion) => exclusion.polygon.length >= 3);
}

export { EPSILON };
