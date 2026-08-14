import type { Point } from "@/engine/geometry/point";
import type { SolarPanelSpec } from "@/engine/solar/panel";

export type PanelRotation = 0 | 90 | 180 | 270;

export interface PanelPlacement {
  id: string;
  panelId: string;
  center: Point;
  rotation: PanelRotation;
}

export interface PanelFootprint {
  widthM: number;
  lengthM: number;
}

export function panelFootprint(panel: SolarPanelSpec, rotation: PanelRotation): PanelFootprint {
  return rotation % 180 === 0
    ? { widthM: panel.widthM, lengthM: panel.lengthM }
    : { widthM: panel.lengthM, lengthM: panel.widthM };
}

export function placementCorners(placement: PanelPlacement, panel: SolarPanelSpec): Point[] {
  const footprint = panelFootprint(panel, placement.rotation);
  const halfWidth = footprint.widthM / 2;
  const halfLength = footprint.lengthM / 2;
  const { x, y } = placement.center;
  return [
    { x: x - halfWidth, y: y - halfLength },
    { x: x + halfWidth, y: y - halfLength },
    { x: x + halfWidth, y: y + halfLength },
    { x: x - halfWidth, y: y + halfLength },
  ];
}

export function axisAlignedBounds(points: Point[]) {
  if (!points.length) throw new Error("Cannot calculate bounds for empty geometry");
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: points[0].x, minY: points[0].y, maxX: points[0].x, maxY: points[0].y },
  );
}

export function boundsOverlap(a: ReturnType<typeof axisAlignedBounds>, b: ReturnType<typeof axisAlignedBounds>, clearance = 0): boolean {
  return !(a.maxX + clearance <= b.minX || b.maxX + clearance <= a.minX || a.maxY + clearance <= b.minY || b.maxY + clearance <= a.minY);
}

export function placementOverlapsAny(placement: PanelPlacement, panel: SolarPanelSpec, existing: PanelPlacement[], panelById: (id: string) => SolarPanelSpec | undefined, clearance = 0): boolean {
  const candidate = axisAlignedBounds(placementCorners(placement, panel));
  return existing.some((other) => {
    const otherPanel = panelById(other.panelId);
    if (!otherPanel || other.id === placement.id) return false;
    return boundsOverlap(candidate, axisAlignedBounds(placementCorners(other, otherPanel)), clearance);
  });
}
