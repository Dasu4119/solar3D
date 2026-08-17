import type { Point } from "@/engine/geometry/point";

export interface RoofPlane {
  id: string;
  polygon: Point[];
  pitchDeg: number;
  azimuthDeg: number;
  elevationM?: number;
}

export interface RoofPlaneAnalysis {
  areaM2: number;
  centroid: Point;
  pitchDeg: number;
  azimuthDeg: number;
}

function signedArea(points: Point[]) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

export function polygonAreaM2(points: Point[]) {
  return Math.abs(signedArea(points));
}

export function polygonCentroid(points: Point[]): Point {
  const area = signedArea(points);
  if (Math.abs(area) < 1e-9) {
    return points.reduce((sum, p) => ({ x: sum.x + p.x, y: sum.y + p.y }), { x: 0, y: 0 });
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const factor = a.x * b.y - b.x * a.y;
    cx += (a.x + b.x) * factor;
    cy += (a.y + b.y) * factor;
  }
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

export function analyzeRoofPlane(plane: RoofPlane): RoofPlaneAnalysis {
  return {
    areaM2: polygonAreaM2(plane.polygon),
    centroid: polygonCentroid(plane.polygon),
    pitchDeg: plane.pitchDeg,
    azimuthDeg: ((plane.azimuthDeg % 360) + 360) % 360,
  };
}

export function validateRoofPlane(plane: RoofPlane): string[] {
  const errors: string[] = [];
  if (plane.polygon.length < 3) errors.push("Roof plane requires at least 3 polygon points");
  if (!Number.isFinite(plane.pitchDeg) || plane.pitchDeg < 0 || plane.pitchDeg > 90) errors.push("Pitch must be between 0 and 90 degrees");
  if (!Number.isFinite(plane.azimuthDeg)) errors.push("Azimuth must be finite");
  if (polygonAreaM2(plane.polygon) <= 1e-9) errors.push("Roof plane polygon must have non-zero area");
  return errors;
}

export function sortRoofPlanesByUsableArea(planes: RoofPlane[]): RoofPlane[] {
  return [...planes].sort((a, b) => polygonAreaM2(b.polygon) - polygonAreaM2(a.polygon));
}
