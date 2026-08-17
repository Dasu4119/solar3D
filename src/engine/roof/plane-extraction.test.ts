import { describe, expect, it } from 'vitest';
import { extractRoofPlanes, roofPlaneOrientation, RoofMesh } from './plane-extraction';

const mesh = (vertices: RoofMesh['vertices'], triangles: RoofMesh['triangles']): RoofMesh => ({ vertices, triangles });

describe('roof plane extraction', () => {
  it('detects a flat plane at zero pitch', () => {
    const m = mesh([{x:0,y:0,z:0},{x:2,y:0,z:0},{x:2,y:2,z:0},{x:0,y:2,z:0}], [{a:0,b:1,c:2},{a:0,b:2,c:3}]);
    const [p] = extractRoofPlanes(m, { minAreaM2: 0.1 });
    expect(p.areaM2).toBeCloseTo(4); expect(p.pitchDeg).toBeCloseTo(0);
  });
  it('is invariant to mixed triangle winding', () => {
    const m = mesh([{x:0,y:0,z:0},{x:2,y:0,z:0},{x:2,y:2,z:0},{x:0,y:2,z:0}], [{a:0,b:2,c:1},{a:3,b:2,c:0}]);
    const [p] = extractRoofPlanes(m, { minAreaM2: 0.1 });
    expect(p.pitchDeg).toBeCloseTo(0); expect(p.triangleIndices).toEqual([0,1]);
  });
  it('separates a two-plane gable roof', () => {
    const m = mesh([{x:0,y:0,z:0},{x:2,y:0,z:0},{x:2,y:2,z:1},{x:0,y:2,z:1},{x:4,y:0,z:0},{x:4,y:2,z:1}], [{a:0,b:1,c:2},{a:0,b:2,c:3},{a:1,b:4,c:5},{a:1,b:5,c:2}]);
    const planes = extractRoofPlanes(m, { minAreaM2: 0.1 });
    expect(planes).toHaveLength(2); expect(planes.every(p => p.pitchDeg > 0)).toBe(true);
  });
  it('ignores degenerate and sub-threshold triangles', () => {
    const m = mesh([{x:0,y:0,z:0},{x:2,y:0,z:0},{x:2,y:2,z:0},{x:0,y:2,z:0}], [{a:0,b:1,c:2},{a:0,b:0,c:0},{a:0,b:1,c:1}]);
    const planes = extractRoofPlanes(m, { minAreaM2: 0.5 });
    expect(planes).toHaveLength(1); expect(planes[0].triangleIndices).toEqual([0]);
  });
  it('returns deterministic orientation', () => {
    expect(roofPlaneOrientation({x:0,y:0,z:1})).toEqual({pitchDeg:0, azimuthDeg:0});
    const a = roofPlaneOrientation({x:0,y:1,z:0}); expect(a.pitchDeg).toBeCloseTo(90); expect(a.azimuthDeg).toBeCloseTo(0);
  });
});
