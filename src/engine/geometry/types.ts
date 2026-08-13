export type Point2D = { x: number; y: number };
export type Size2D = { width: number; height: number };
export type Bounds2D = { min: Point2D; max: Point2D };
export type Polygon2D = Point2D[];

export type Transform2D = {
  position: Point2D;
  rotation: number;
  scale: Point2D;
};

export function distance(a: Point2D, b: Point2D): number { return Math.hypot(b.x - a.x, b.y - a.y); }
export function polygonArea(points: Polygon2D): number {
  if (points.length < 3) return 0;
  return Math.abs(points.reduce((sum, a, i) => { const b = points[(i + 1) % points.length]; return sum + a.x * b.y - b.x * a.y; }, 0)) / 2;
}
export function polygonPerimeter(points: Polygon2D): number {
  if (points.length < 2) return 0;
  return points.reduce((sum, a, i) => sum + distance(a, points[(i + 1) % points.length]), 0);
}
export function pointInPolygon(point: Point2D, polygon: Polygon2D): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    const crosses = (a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}
export function translate(points: Polygon2D, dx: number, dy: number): Polygon2D { return points.map((p) => ({ x: p.x + dx, y: p.y + dy })); }
export function rotate(point: Point2D, angleRadians: number, origin: Point2D = { x: 0, y: 0 }): Point2D {
  const x = point.x - origin.x, y = point.y - origin.y, c = Math.cos(angleRadians), s = Math.sin(angleRadians);
  return { x: origin.x + x * c - y * s, y: origin.y + x * s + y * c };
}
