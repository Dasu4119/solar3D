import type { Point } from "@/engine/geometry/point";
import type { PanelPlacement } from "@/engine/solar/placement";
import type { SolarPanelSpec } from "@/engine/solar/panel";
import type { RoofPlane } from "@/engine/solar/layout/roof-planes";

export interface Vector3 { x: number; y: number; z: number }

export interface RoofObstaclePrism {
  id: string;
  footprint: Point[];
  minZM?: number;
  maxZM: number;
}

export interface OcclusionOptions {
  samplesX?: number;
  samplesY?: number;
  rayStartOffsetM?: number;
  maxRayDistanceM?: number;
}

const EPSILON = 1e-9;

function dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function add(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scale(a: Vector3, s: number): Vector3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

function normalize(v: Vector3): Vector3 {
  const length = Math.hypot(v.x, v.y, v.z);
  if (length <= EPSILON) throw new Error("Sun vector must be non-zero");
  return scale(v, 1 / length);
}

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects =
      (a.y > point.y) !== (b.y > point.y) &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function cross2(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

function segmentIntersectionT(a: Point, b: Point, origin: Point, direction: Point): number | undefined {
  const edge = { x: b.x - a.x, y: b.y - a.y };
  const denominator = cross2(direction, edge);
  const offset = { x: a.x - origin.x, y: a.y - origin.y };
  if (Math.abs(denominator) <= EPSILON) return undefined;
  const t = cross2(offset, edge) / denominator;
  const u = cross2(offset, direction) / denominator;
  return t >= -EPSILON && u >= -EPSILON && u <= 1 + EPSILON ? Math.max(0, t) : undefined;
}

function rayHitsPrism(origin: Vector3, direction: Vector3, obstacle: RoofObstaclePrism, maxDistance: number): boolean {
  if (obstacle.footprint.length < 3 || obstacle.maxZM <= (obstacle.minZM ?? 0)) return false;

  const minZ = obstacle.minZM ?? 0;
  const maxZ = obstacle.maxZM;
  const zTimes: number[] = [0, maxDistance];
  if (Math.abs(direction.z) > EPSILON) {
    for (const z of [minZ, maxZ]) {
      const t = (z - origin.z) / direction.z;
      if (t >= 0 && t <= maxDistance) zTimes.push(t);
    }
  } else if (origin.z < minZ || origin.z > maxZ) {
    return false;
  }

  const origin2 = { x: origin.x, y: origin.y };
  const direction2 = { x: direction.x, y: direction.y };
  const tValues = [...zTimes];
  if (Math.hypot(direction2.x, direction2.y) > EPSILON) {
    for (let i = 0; i < obstacle.footprint.length; i++) {
      const a = obstacle.footprint[i];
      const b = obstacle.footprint[(i + 1) % obstacle.footprint.length];
      const t = segmentIntersectionT(a, b, origin2, direction2);
      if (t !== undefined && t <= maxDistance) tValues.push(t);
    }
  }

  tValues.sort((a, b) => a - b);
  const unique: number[] = [];
  for (const t of tValues) {
    if (!unique.length || Math.abs(t - unique[unique.length - 1]) > 1e-7) unique.push(t);
  }

  for (const t of unique) {
    if (t >= 0 && t <= maxDistance) {
      const p = add(origin, scale(direction, t));
      if (p.z >= minZ - EPSILON && p.z <= maxZ + EPSILON && pointInPolygon({ x: p.x, y: p.y }, obstacle.footprint)) return true;
    }
  }

  for (let i = 0; i + 1 < unique.length; i++) {
    const mid = (unique[i] + unique[i + 1]) / 2;
    if (mid < 0 || mid > maxDistance) continue;
    const p = add(origin, scale(direction, mid));
    if (p.z >= minZ - EPSILON && p.z <= maxZ + EPSILON && pointInPolygon({ x: p.x, y: p.y }, obstacle.footprint)) return true;
  }

  return false;
}

function roofBasis(plane: RoofPlane): { origin: Vector3; crossSlope: Vector3; slope: Vector3 } {
  const pitch = (plane.pitchDeg * Math.PI) / 180;
  const azimuth = (plane.azimuthDeg * Math.PI) / 180;
  const face = { x: Math.sin(azimuth), y: Math.cos(azimuth), z: 0 };
  const crossSlope = { x: Math.cos(azimuth), y: -Math.sin(azimuth), z: 0 };
  const slope = {
    x: -face.x * Math.cos(pitch),
    y: -face.y * Math.cos(pitch),
    z: Math.sin(pitch),
  };
  const elevation = plane.elevationM ?? 0;
  const centroid = plane.polygon.reduce((sum, p) => ({ x: sum.x + p.x, y: sum.y + p.y }), { x: 0, y: 0 });
  const origin2 = { x: centroid.x / plane.polygon.length, y: centroid.y / plane.polygon.length };
  return { origin: { x: origin2.x, y: origin2.y, z: elevation }, crossSlope, slope };
}

function panelSamplePoints(panel: SolarPanelSpec, placement: PanelPlacement, plane: RoofPlane, options: OcclusionOptions): Vector3[] {
  const samplesX = Math.max(1, Math.floor(options.samplesX ?? 6));
  const samplesY = Math.max(1, Math.floor(options.samplesY ?? 10));
  const width = placement.rotation % 180 === 0 ? panel.widthM : panel.lengthM;
  const length = placement.rotation % 180 === 0 ? panel.lengthM : panel.widthM;
  const basis = roofBasis(plane);
  const center = add(basis.origin, add(scale(basis.crossSlope, placement.center.x - basis.origin.x), scale(basis.slope, placement.center.y - basis.origin.y)));
  const points: Vector3[] = [];
  for (let ix = 0; ix < samplesX; ix++) {
    const u = ((ix + 0.5) / samplesX - 0.5) * width;
    for (let iy = 0; iy < samplesY; iy++) {
      const v = ((iy + 0.5) / samplesY - 0.5) * length;
      points.push(add(center, add(scale(basis.crossSlope, u), scale(basis.slope, v))));
    }
  }
  return points;
}

export function calculatePanelShadeFraction(
  panel: SolarPanelSpec,
  placement: PanelPlacement,
  plane: RoofPlane,
  sunVector: Vector3,
  obstacles: RoofObstaclePrism[],
  options: OcclusionOptions = {},
): number {
  const direction = normalize(sunVector);
  if (direction.z <= 0) return 1;
  const samples = panelSamplePoints(panel, placement, plane, options);
  const offset = options.rayStartOffsetM ?? 0.02;
  const maxDistance = options.maxRayDistanceM ?? 500;
  let blocked = 0;
  for (const sample of samples) {
    const origin = add(sample, scale(direction, offset));
    if (obstacles.some((obstacle) => rayHitsPrism(origin, direction, obstacle, maxDistance))) blocked++;
  }
  return samples.length ? blocked / samples.length : 0;
}

export function calculateShadeFractions(
  panel: SolarPanelSpec,
  placements: PanelPlacement[],
  planeById: (id: string | undefined) => RoofPlane | undefined,
  sunVector: Vector3,
  obstacles: RoofObstaclePrism[],
  options: OcclusionOptions = {},
): Map<string, number> {
  const result = new Map<string, number>();
  for (const placement of placements) {
    const plane = planeById(placement.panelId);
    if (!plane) {
      result.set(placement.id, 0);
      continue;
    }
    result.set(placement.id, calculatePanelShadeFraction(panel, placement, plane, sunVector, obstacles, options));
  }
  return result;
}
