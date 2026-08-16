import type { Point } from "@/engine/geometry/point";
import type { SolarPanelSpec } from "@/engine/solar/panel";
import type { PanelPlacement } from "@/engine/solar/placement";
import { validatePanelPlacement } from "@/engine/solar/roof-validation";
import { findBlockingObstacle, panelFootprint } from "./obstacles";
import { commonHorizontalIntervals, polygonBounds } from "./polygon-packing";
import type { LayoutCandidate, LayoutConstraints } from "./types";

export function generateLayoutCandidates(
  roof: Point[],
  panel: SolarPanelSpec,
  constraints: LayoutConstraints = {},
  existingPlacements: PanelPlacement[] = [],
): LayoutCandidate[] {
  const b = polygonBounds(roof);
  const edge = constraints.edgeGapM ?? constraints.setbackM ?? 0;
  const gap = constraints.panelGapM ?? 0;
  const rotations = constraints.allowedRotations ?? [0, 90];
  const candidates: LayoutCandidate[] = [];

  for (const rotation of rotations) {
    const width = rotation % 180 === 0 ? panel.widthM : panel.lengthM;
    const length = rotation % 180 === 0 ? panel.lengthM : panel.widthM;
    const stepX = Math.max(width + gap, 0.01);
    const stepY = Math.max(length + gap, 0.01);

    for (let y = b.minY + edge + length / 2; y <= b.maxY - edge - length / 2 + 1e-9; y += stepY) {
      const intervals = commonHorizontalIntervals(roof, y - length / 2 - edge, y + length / 2 + edge);
      for (const interval of intervals) {
        for (let x = interval.minX + edge + width / 2; x <= interval.maxX - edge - width / 2 + 1e-9; x += stepX) {
          const placement: PanelPlacement = {
            id: `layout-${candidates.length + 1}`,
            panelId: panel.id,
            center: { x, y },
            rotation,
          };
          const result = validatePanelPlacement(roof, placement, panel, {
            northM: edge, eastM: edge, southM: edge, westM: edge,
          }, existingPlacements);
          const blocker = result.valid
            ? findBlockingObstacle(panelFootprint(placement.center, width, length, rotation), constraints.obstacles)
            : undefined;
          const valid = result.valid && !blocker;
          candidates.push({ placement, valid, score: valid ? panel.powerWatts : -Infinity, blockedByObstacleId: blocker?.id });
        }
      }
    }
  }
  return candidates;
}
