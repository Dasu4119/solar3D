import { z } from 'zod';

export const point2DSchema = z.object({ x: z.number().finite(), y: z.number().finite() });
export const point3DSchema = point2DSchema.extend({ z: z.number().finite().default(0) });

export const polygonSchema = z.object({
  points: z.array(point2DSchema).min(3),
});

export const obstacleSchema = z.object({
  id: z.string().min(1),
  polygon: polygonSchema,
  keepoutDistanceM: z.number().finite().nonnegative(),
});

export const panelSchema = z.object({
  id: z.string().min(1),
  center: point3DSchema,
  lengthM: z.number().finite().positive(),
  widthM: z.number().finite().positive(),
  rotationDegrees: z.number().finite(),
  setbackM: z.number().finite().nonnegative(),
});

export const canonicalGeometrySchema = z.object({
  schemaVersion: z.literal(1),
  roofs: z.array(z.object({
    id: z.string().min(1),
    polygon: polygonSchema,
    elevationM: z.number().finite(),
    obstacles: z.array(obstacleSchema),
    panels: z.array(panelSchema),
  })).min(1),
});

export type CanonicalGeometry = z.infer<typeof canonicalGeometrySchema>;
export type CanonicalRoof = CanonicalGeometry['roofs'][number];
export type CanonicalPanel = CanonicalRoof['panels'][number];

export interface GeometryValidationIssue {
  code: string;
  message: string;
  roofId?: string;
  panelId?: string;
  obstacleId?: string;
}

export interface GeometryValidationResult {
  valid: boolean;
  issues: GeometryValidationIssue[];
}

function pointInPolygon(point: { x: number; y: number }, points: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    const intersects = ((a.y > point.y) !== (b.y > point.y)) &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function distanceSquared(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function minDistanceToPolygon(point: { x: number; y: number }, polygon: { x: number; y: number }[]): number {
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const lengthSquared = abx * abx + aby * aby;
    const t = lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSquared));
    const projection = { x: a.x + t * abx, y: a.y + t * aby };
    min = Math.min(min, Math.sqrt(distanceSquared(point, projection)));
  }
  return min;
}

function panelCorners(panel: CanonicalPanel): { x: number; y: number }[] {
  const theta = (panel.rotationDegrees * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const hx = panel.lengthM / 2;
  const hy = panel.widthM / 2;
  return [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]].map(([x, y]) => ({
    x: panel.center.x + x * cos - y * sin,
    y: panel.center.y + x * sin + y * cos,
  }));
}

export function validateCanonicalGeometry(input: unknown): GeometryValidationResult {
  const parsed = canonicalGeometrySchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      issues: parsed.error.issues.map((issue) => ({
        code: `SCHEMA_${issue.code.toUpperCase()}`,
        message: `${issue.path.join('.') || 'geometry'}: ${issue.message}`,
      })),
    };
  }

  const issues: GeometryValidationIssue[] = [];
  for (const roof of parsed.data.roofs) {
    const roofPoints = roof.polygon.points;
    for (const obstacle of roof.obstacles) {
      if (!pointInPolygon(obstacle.polygon.points[0], roofPoints)) {
        issues.push({ code: 'OBSTACLE_OUTSIDE_ROOF', message: 'Obstacle must be contained by its roof polygon.', roofId: roof.id, obstacleId: obstacle.id });
      }
      if (obstacle.keepoutDistanceM < 0) {
        issues.push({ code: 'NEGATIVE_KEEPOUT', message: 'Obstacle keepout distance cannot be negative.', roofId: roof.id, obstacleId: obstacle.id });
      }
    }

    for (const panel of roof.panels) {
      const corners = panelCorners(panel);
      for (const corner of corners) {
        if (!pointInPolygon(corner, roofPoints)) {
          issues.push({ code: 'PANEL_OUTSIDE_ROOF', message: 'Panel footprint must remain inside the roof polygon.', roofId: roof.id, panelId: panel.id });
          break;
        }
      }

      const roofEdgeDistance = minDistanceToPolygon(panel.center, roofPoints);
      if (roofEdgeDistance < panel.setbackM) {
        issues.push({ code: 'PANEL_SETBACK_VIOLATION', message: `Panel requires at least ${panel.setbackM} m roof-edge setback.`, roofId: roof.id, panelId: panel.id });
      }

      for (const obstacle of roof.obstacles) {
        const obstacleEdgeDistance = minDistanceToPolygon(panel.center, obstacle.polygon.points);
        if (obstacleEdgeDistance < obstacle.keepoutDistanceM + Math.max(panel.lengthM, panel.widthM) / 2) {
          issues.push({ code: 'PANEL_OBSTACLE_KEEPOUT_VIOLATION', message: `Panel intersects the obstacle keepout zone for ${obstacle.id}.`, roofId: roof.id, panelId: panel.id, obstacleId: obstacle.id });
        }
      }
    }
  }

  return { valid: issues.length === 0, issues };
}
