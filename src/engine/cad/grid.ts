export interface GridConfig { size: number; enabled: boolean }

export function snapToGrid(value: number, grid: GridConfig): number {
  if (!grid.enabled || grid.size <= 0) return value;
  return Math.round(value / grid.size) * grid.size;
}

export function snapPointToGrid<T extends { x: number; y: number }>(point: T, grid: GridConfig): T {
  return { ...point, x: snapToGrid(point.x, grid), y: snapToGrid(point.y, grid) };
}
