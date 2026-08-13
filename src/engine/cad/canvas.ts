export interface CanvasPoint { x: number; y: number }

export interface Viewport { zoom: number; panX: number; panY: number }

export function screenToWorld(point: CanvasPoint, viewport: Viewport, rect: { left: number; top: number }): CanvasPoint {
  return {
    x: (point.x - rect.left - viewport.panX) / viewport.zoom,
    y: (point.y - rect.top - viewport.panY) / viewport.zoom,
  };
}

export function worldToScreen(point: CanvasPoint, viewport: Viewport, rect: { left: number; top: number }): CanvasPoint {
  return {
    x: point.x * viewport.zoom + viewport.panX + rect.left,
    y: point.y * viewport.zoom + viewport.panY + rect.top,
  };
}

export function zoomAt(viewport: Viewport, factor: number, anchor: CanvasPoint): Viewport {
  const nextZoom = Math.min(8, Math.max(0.1, viewport.zoom * factor));
  const ratio = nextZoom / viewport.zoom;
  return {
    zoom: nextZoom,
    panX: anchor.x - (anchor.x - viewport.panX) * ratio,
    panY: anchor.y - (anchor.y - viewport.panY) * ratio,
  };
}
