import type { Point2D } from "@/engine/geometry/types";

export type SnapTarget = { point: Point2D; distance: number; type: "grid" | "vertex" };

export function snapToGrid(point: Point2D, gridSize: number): Point2D {
  if (gridSize <= 0) return point;
  return { x: Math.round(point.x / gridSize) * gridSize, y: Math.round(point.y / gridSize) * gridSize };
}

export function nearestVertex(point: Point2D, vertices: Point2D[], tolerance: number): SnapTarget | null {
  let best: SnapTarget | null = null;
  for (const vertex of vertices) {
    const distance = Math.hypot(vertex.x - point.x, vertex.y - point.y);
    if (distance <= tolerance && (!best || distance < best.distance)) best = { point: vertex, distance, type: "vertex" };
  }
  return best;
}
