import type { Point } from "@/engine/geometry/point";
import type { SolarPanelSpec } from "@/engine/solar/panel";
import type { PanelPlacement } from "@/engine/solar/placement";
import { isPolygonUsable, type UsableRoofRegion } from "@/engine/geometry/roof-constraints";
import { validatePanelPlacement } from "@/engine/solar/roof-validation";
import { findBlockingObstacle, panelFootprint } from "./obstacles";
import { commonHorizontalIntervals, polygonBounds } from "./polygon-packing";
import type { LayoutCandidate, LayoutConstraints, LayoutRoofRegion } from "./types";
import type { RoofPlane } from "./roof-planes";

function regionContainsPoint(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y)) {
      const x = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
      if (point.x < x) inside = !inside;
    }
  }
  return inside;
}

function regionAllowsPanel(center: Point, width: number, length: number, region: LayoutRoofRegion): boolean {
  const samples = [center,
    { x: center.x - width / 2, y: center.y - length / 2 },
    { x: center.x + width / 2, y: center.y - length / 2 },
    { x: center.x + width / 2, y: center.y + length / 2 },
    { x: center.x - width / 2, y: center.y + length / 2 }];
  return samples.every((p) => regionContainsPoint(p, region.outer) && !(region.holes ?? []).some((hole) => regionContainsPoint(p, hole)));
}

function generateForRegion(
  region: LayoutRoofRegion,
  panel: SolarPanelSpec,
  constraints: LayoutConstraints,
  existingPlacements: PanelPlacement[],
  idOffset: number,
  canonicalRegion?: UsableRoofRegion,
): LayoutCandidate[] {
  const b = polygonBounds(region.outer);
  const candidates: LayoutCandidate[] = [];
  const rotations = constraints.allowedRotations ?? [0, 90];
  const edge = canonicalRegion ? 0 : (constraints.edgeGapM ?? constraints.setbackM ?? 0);
  const gap = constraints.panelGapM ?? 0;

  for (const rotation of rotations) {
    const width = rotation % 180 === 0 ? panel.widthM : panel.lengthM;
    const length = rotation % 180 === 0 ? panel.lengthM : panel.widthM;
    const stepX = Math.max(width + gap, 0.01);
    const stepY = Math.max(length + gap, 0.01);
    for (let y = b.minY + edge + length / 2; y <= b.maxY - edge - length / 2 + 1e-9; y += stepY) {
      const intervals = commonHorizontalIntervals(region.outer, y - length / 2 - edge, y + length / 2 + edge);
      for (const interval of intervals) {
        for (let x = interval.minX + edge + width / 2; x <= interval.maxX - edge - width / 2 + 1e-9; x += stepX) {
          const placement: PanelPlacement = { id: `layout-${idOffset + candidates.length + 1}`, panelId: panel.id, center: { x, y }, rotation: rotation as 0 | 90 | 180 | 270 };
          const corners = [
            { x: x - width / 2, y: y - length / 2 },
            { x: x + width / 2, y: y - length / 2 },
            { x: x + width / 2, y: y + length / 2 },
            { x: x - width / 2, y: y + length / 2 },
          ];
          const canonicalValid = canonicalRegion ? isPolygonUsable(corners, canonicalRegion) : false;
          const insideRegion = canonicalRegion
            ? canonicalValid
            : regionAllowsPanel(placement.center, width + edge * 2, length + edge * 2, region);
          const result = insideRegion
            ? validatePanelPlacement(region.outer, placement, panel, { northM: edge, eastM: edge, southM: edge, westM: edge }, existingPlacements)
            : { valid: false, reasons: ["Panel footprint violates canonical roof constraints"] };
          const blocker = result.valid ? findBlockingObstacle(panelFootprint(placement.center, width, length, rotation), constraints.obstacles) : undefined;
          const valid = result.valid && !blocker;
          candidates.push({ placement, valid, score: valid ? panel.powerWatts : -Infinity, blockedByObstacleId: blocker?.id, roofPlaneId: region.roofPlaneId });
        }
      }
    }
  }
  return candidates;
}

export function generateLayoutCandidates(
  roof: Point[],
  panel: SolarPanelSpec,
  constraints: LayoutConstraints = {},
  existingPlacements: PanelPlacement[] = [],
  roofRegions?: LayoutRoofRegion[],
  roofPlanes?: RoofPlane[],
  usableRoofRegions?: UsableRoofRegion[],
): LayoutCandidate[] {
  const canonical = usableRoofRegions?.length ? usableRoofRegions : undefined;
  const regions = canonical
    ? canonical.map((region) => ({ outer: region.roof }))
    : roofRegions?.length
      ? roofRegions
      : roofPlanes?.length
        ? roofPlanes.map((plane) => ({ outer: plane.polygon, roofPlaneId: plane.id }))
        : [{ outer: roof }];
  return regions.flatMap((region, index) => generateForRegion(
    region,
    panel,
    constraints,
    existingPlacements,
    index * 100000,
    canonical?.[index],
  ));
}
