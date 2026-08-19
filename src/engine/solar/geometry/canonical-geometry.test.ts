import { describe, expect, it } from 'vitest';
import { validateCanonicalGeometry } from './canonical-geometry';

const baseGeometry = {
  schemaVersion: 1 as const,
  roofs: [{
    id: 'roof-1',
    polygon: { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }, { x: 0, y: 6 }] },
    elevationM: 0,
    obstacles: [],
    panels: [{ id: 'panel-1', center: { x: 5, y: 3, z: 0 }, lengthM: 2, widthM: 1, rotationDegrees: 0, setbackM: 0.5 }],
  }],
};

describe('validateCanonicalGeometry', () => {
  it('accepts a valid roof and panel footprint', () => {
    const result = validateCanonicalGeometry(baseGeometry);
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('rejects panels that cross the roof boundary', () => {
    const geometry = structuredClone(baseGeometry);
    geometry.roofs[0].panels[0].center.x = 9.5;
    const result = validateCanonicalGeometry(geometry);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'PANEL_OUTSIDE_ROOF')).toBe(true);
  });

  it('rejects insufficient roof-edge setback', () => {
    const geometry = structuredClone(baseGeometry);
    geometry.roofs[0].panels[0].center.x = 0.7;
    const result = validateCanonicalGeometry(geometry);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'PANEL_SETBACK_VIOLATION')).toBe(true);
  });

  it('rejects a panel inside an obstacle keepout zone', () => {
    const geometry = structuredClone(baseGeometry);
    geometry.roofs[0].obstacles = [{
      id: 'vent-1',
      polygon: { points: [{ x: 4, y: 2 }, { x: 6, y: 2 }, { x: 6, y: 4 }, { x: 4, y: 4 }] },
      keepoutDistanceM: 1,
    }];
    const result = validateCanonicalGeometry(geometry);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'PANEL_OBSTACLE_KEEPOUT_VIOLATION')).toBe(true);
  });

  it('rejects malformed geometry before engineering calculations can consume it', () => {
    const result = validateCanonicalGeometry({ schemaVersion: 1, roofs: [] });
    expect(result.valid).toBe(false);
    expect(result.issues[0].code).toMatch(/^SCHEMA_/);
  });
});
