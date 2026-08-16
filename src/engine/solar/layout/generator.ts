import type { Point } from "@/engine/geometry/point";
import type { SolarPanelSpec } from "@/engine/solar/panel";
import type { PanelPlacement } from "@/engine/solar/placement";
import { validatePanelPlacement } from "@/engine/solar/roof-validation";
import { findBlockingObstacle, panelFootprint } from "./obstacles";
import { commonHorizontalIntervals, polygonBounds } from "./polygon-packing";
import type { LayoutCandidate, LayoutConstraints, LayoutRoofRegion } from "./types";

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
  const samples = [
    center,
    { x: center.x - width / 2, y: center.y - length / 2 },
    { x: center.x + width / 2, y: center.y - length / 2 },
    { x: center.x + width / 2, y: center.y + length / 2 },
    { x: center.x - width / 2, y: center.y + length / 2 },
  ];
  return samples.every((p) => regionContainsPoint(p, region.outer) && !(region.holes ?? []).some((hole) => regionContainsPoint(p, hole)));
}

export function generateLayoutCandidates(
  roof: Point[],
  panel: SolarPanelSpec,
  constraints: LayoutConstraints = {},
  existingPlacements: PanelPlacement[] = [],
  roofRegions?: LayoutRoofRegion[],
): LayoutCandidate[] {
  const regions = roofRegions?.length ? roofRegions : [{ outer: roof }];
  const candidates: LayoutCandidate[] = [];
  const rotations = constraints.allowedRotations ?? [0, 90];
  const edge = constraints.edgeGapM ?? constraints.setbackM ?? 0;
  const gap = constraints.panelGapM ?? 0;

  for (const region of regions) {
    const b = polygonBounds(region.outer);
    for (const rotation of rotations) {
      const width = rotation % 180 === 0 ? panel.widthM : panel.lengthM;
      const length = rotation % 180 === 0 ? panel.lengthM : panel.widthM;
      const stepX = Math.max(width + gap, 0.01);
      const stepY = Math.max(length + gap, 0.01);

      for (let y = b.minY + edge + length / 2; y <= b.maxY - edge - length / 2 + 1e-9; y += stepY) {
        const intervals = commonHorizontalIntervals(region.outer, y - length / 2 - edge, y + length / 2 + edge);
        for (const interval of intervals) {
          for (let x = interval.minX + edge + width / 2; x <= interval.maxX - edge - width / 2 + 1e-9; x += stepX) {
            const placement: PanelPlacement = {
              id: `layout-${candidates.length + 1}`,
              panelId: panel.id,
              center: { x, y },
              rotation,
            };
            const insideRegion = regionAllowsPanel(placement.center, width + edge * 2, length + edge * 2, region);
            const result = insideRegion ? validatePanelPlacement(region.outer, placement, panel, {
              northM: edge, eastM: edge, southM: edge, westM: edge,
            }, existingPlacements) : { valid: false };
            const blocker = result.valid
              ? findBlockingObstacle(panelFootprint(placement.center, width, length, rotation), constraints.obstacles)
              : undefined;
            const valid = result.valid && !blocker;
            candidates.push({ placement, valid, score: valid ? panel.powerWatts : -Infinity, blockedByObstacleId: blocker?.id });
          }
        }
      }
    }
  }
  return candidates;
}
