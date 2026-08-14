import type { Point } from "@/engine/geometry/point";
import { placementCorners, type PanelPlacement } from "@/engine/solar/placement";
import type { SolarPanelSpec } from "@/engine/solar/panel";

export interface Setback {
  northM: number;
  eastM: number;
  southM: number;
  westM: number;
}

export interface PanelPlacementValidation {
  valid: boolean;
  reasons: string[];
}

const EPSILON = 1e-9;

export function validatePanelPlacement(
  roof: Point[],
  placement: PanelPlacement,
  panel: SolarPanelSpec,
  setback: Setback = { northM: 0, eastM: 0, southM: 0, westM: 0 },
): PanelPlacementValidation {
  if (roof.length < 3) return { valid: false, reasons: ["Roof must have at least 3 vertices"] };
  const usableRoof = insetAxisAlignedRoof(roof, setback);
  const corners = placementCorners(placement, panel);
  const inside = corners.every((corner) => pointInPolygon(corner, usableRoof));
  return inside
    ? { valid: true, reasons: [] }
    : { valid: false, reasons: ["Panel footprint crosses the roof boundary or setback zone"] };
}

function insetAxisAlignedRoof(roof: Point[], setback: Setback): Point[] {
  const minX = Math.min(...roof.map((p) => p.x)) + setback.westM;
  const maxX = Math.max(...roof.map((p) => p.x)) - setback.eastM;
  const minY = Math.min(...roof.map((p) => p.y)) + setback.southM;
  const maxY = Math.max(...roof.map((p) => p.y)) - setback.northM;
  if (minX >= maxX || minY >= maxY) return [];
  return [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }];
}

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (pointOnSegment(point, a, b)) return true;
    const intersects = ((a.y > point.y) !== (b.y > point.y))
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointOnSegment(p: Point, a: Point, b: Point): boolean {
  const cross = (p.y - a.y) * (b.x - a.x) - (p.x - a.x) * (b.y - a.y);
  if (Math.abs(cross) > EPSILON) return false;
  return p.x >= Math.min(a.x, b.x) - EPSILON && p.x <= Math.max(a.x, b.x) + EPSILON
    && p.y >= Math.min(a.y, b.y) - EPSILON && p.y <= Math.max(a.y, b.y) + EPSILON;
}
