import type { Bounds2D, Point2D, Polygon2D } from "./types";

export const distance = (a: Point2D, b: Point2D) => Math.hypot(b.x - a.x, b.y - a.y);

export const polygonArea = (polygon: Polygon2D) => {
  if (polygon.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
};

export const polygonPerimeter = (polygon: Polygon2D) => {
  if (polygon.length < 2) return 0;
  return polygon.reduce((total, point, index) => total + distance(point, polygon[(index + 1) % polygon.length]), 0);
};

export const boundsOf = (points: Point2D[]): Bounds2D => {
  if (!points.length) return { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } };
  return points.reduce((bounds, point) => ({
    min: { x: Math.min(bounds.min.x, point.x), y: Math.min(bounds.min.y, point.y) },
    max: { x: Math.max(bounds.max.x, point.x), y: Math.max(bounds.max.y, point.y) },
  }), { min: { ...points[0] }, max: { ...points[0] } });
};

export const pointInPolygon = (point: Point2D, polygon: Polygon2D) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects = ((a.y > point.y) !== (b.y > point.y)) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
};

export const rotatePoint = (point: Point2D, center: Point2D, radians: number): Point2D => {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
};
