export interface Vec3 { x: number; y: number; z: number }
export interface Triangle { a: number; b: number; c: number }
export interface RoofMesh { vertices: Vec3[]; triangles: Triangle[] }
export interface RoofPlane {
  id: string;
  triangleIndices: number[];
  vertexIndices: number[];
  normal: Vec3;
  pitchDeg: number;
  azimuthDeg: number;
  areaM2: number;
  centroid: Vec3;
}

export interface PlaneExtractionOptions {
  normalToleranceDeg?: number;
  distanceToleranceM?: number;
  minAreaM2?: number;
}

const EPS = 1e-9;
const deg = (r: number) => (r * 180) / Math.PI;

function sub(a: Vec3, b: Vec3): Vec3 { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function add(a: Vec3, b: Vec3): Vec3 { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function scale(a: Vec3, s: number): Vec3 { return { x: a.x * s, y: a.y * s, z: a.z * s }; }
function dot(a: Vec3, b: Vec3): number { return a.x * b.x + a.y * b.y + a.z * b.z; }
function cross(a: Vec3, b: Vec3): Vec3 { return { x: a.y*b.z-a.z*b.y, y: a.z*b.x-a.x*b.z, z: a.x*b.y-a.y*b.x }; }
function length(a: Vec3): number { return Math.hypot(a.x, a.y, a.z); }
function normalize(a: Vec3): Vec3 {
  const l = length(a);
  return l <= EPS ? { x: 0, y: 0, z: 0 } : scale(a, 1 / l);
}
function triangleNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 { return normalize(cross(sub(b,a), sub(c,a))); }
function triangleArea(a: Vec3, b: Vec3, c: Vec3): number { return length(cross(sub(b,a), sub(c,a))) / 2; }
function centroid(vertices: Vec3[]): Vec3 {
  const s = vertices.reduce((v,p) => add(v,p), {x:0,y:0,z:0});
  return scale(s, 1 / Math.max(vertices.length, 1));
}
function angleDeg(a: Vec3, b: Vec3): number {
  const v = Math.min(1, Math.max(-1, dot(a,b)));
  return deg(Math.acos(v));
}
function canonicalNormal(n: Vec3): Vec3 {
  return n.z < 0 ? scale(n, -1) : n;
}
function planeDistance(n: Vec3, p: Vec3, q: Vec3): number { return Math.abs(dot(n, sub(q,p))); }

export function roofPlaneOrientation(normal: Vec3): Pick<RoofPlane, 'pitchDeg'|'azimuthDeg'> {
  const n = canonicalNormal(normalize(normal));
  const pitchDeg = deg(Math.acos(Math.min(1, Math.max(-1, n.z))));
  const azimuthDeg = (deg(Math.atan2(n.x, n.y)) + 360) % 360;
  return { pitchDeg, azimuthDeg };
}

export function extractRoofPlanes(mesh: RoofMesh, options: PlaneExtractionOptions = {}): RoofPlane[] {
  const normalToleranceDeg = options.normalToleranceDeg ?? 2;
  const distanceToleranceM = options.distanceToleranceM ?? 0.03;
  const minAreaM2 = options.minAreaM2 ?? 0.5;
  const candidates = mesh.triangles.map((t, index) => {
    const a = mesh.vertices[t.a], b = mesh.vertices[t.b], c = mesh.vertices[t.c];
    if (!a || !b || !c) return null;
    const raw = triangleNormal(a,b,c);
    const area = triangleArea(a,b,c);
    if (area < minAreaM2 || length(raw) <= EPS) return null;
    return { index, t, a, b, c, normal: canonicalNormal(raw), area };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  const groups: Array<typeof candidates> = [];
  for (const tri of candidates) {
    let group = groups.find(g => {
      const ref = g[0];
      return angleDeg(ref.normal, tri.normal) <= normalToleranceDeg && planeDistance(ref.normal, ref.a, tri.a) <= distanceToleranceM;
    });
    if (!group) { group = []; groups.push(group); }
    group.push(tri);
  }

  return groups.map((group, groupIndex) => {
    const weighted = group.reduce((s,t) => add(s, scale(t.normal,t.area)), {x:0,y:0,z:0});
    const normal = canonicalNormal(normalize(weighted));
    const vertices = [...new Set(group.flatMap(t => [t.t.a,t.t.b,t.t.c]))];
    const points = vertices.map(i => mesh.vertices[i]).filter(Boolean);
    const center = centroid(points);
    const orientation = roofPlaneOrientation(normal);
    return {
      id: `roof-plane-${groupIndex + 1}`,
      triangleIndices: group.map(t => t.index),
      vertexIndices: vertices.sort((a,b) => a-b),
      normal,
      pitchDeg: +orientation.pitchDeg.toFixed(4),
      azimuthDeg: +orientation.azimuthDeg.toFixed(4),
      areaM2: +group.reduce((s,t) => s+t.area,0).toFixed(4),
      centroid: {x:+center.x.toFixed(4), y:+center.y.toFixed(4), z:+center.z.toFixed(4)},
    };
  }).sort((a,b) => b.areaM2-a.areaM2);
}
