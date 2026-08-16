import type { Point } from "@/engine/geometry/point";
import type { SolarPanelSpec } from "@/engine/solar/panel";
import type { PanelPlacement } from "@/engine/solar/placement";
import { validatePanelPlacement } from "@/engine/solar/roof-validation";
import { findBlockingObstacle, panelFootprint } from "./obstacles";
import type { LayoutCandidate, LayoutConstraints } from "./types";

function bounds(points: Point[]) {
  return points.reduce((b, p) => ({
    minX: Math.min(b.minX, p.x), maxX: Math.max(b.maxX, p.x),
    minY: Math.min(b.minY, p.y), maxY: Math.max(b.maxY, p.y),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
}

export function generateLayoutCandidates(
  roof: Point[],
  panel: SolarPanelSpec,
  constraints: LayoutConstraints = {},
  existingPlacements: PanelPlacement[] = [],
): LayoutCandidate[] {
  const b = bounds(roof);
  const edge = constraints.edgeGapM ?? constraints.setbackM ?? 0;
  const gap = constraints.panelGapM ?? 0;
  const rotations = constraints.allowedRotations ?? [0, 90];
  const candidates: LayoutCandidate[] = [];
  const stepX = Math.max(panel.widthM + gap, 0.01);
  const stepY = Math.max(panel.lengthM + gap, 0.01);

  for (const rotation of rotations) {
    const width = rotation % 180 === 0 ? panel.widthM : panel.lengthM;
    const length = rotation % 180 === 0 ? panel.lengthM : panel.widthM;
    for (let y = b.minY + edge + length / 2; y <= b.maxY - edge - length / 2 + 1e-9; y += stepY) {
      for (let x = b.minX + edge + width / 2; x <= b.maxX - edge - width / 2 + 1e-9; x += stepX) {
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
        candidates.push({
          placement,
          valid,
          score: valid ? panel.powerWatts : -Infinity,
          blockedByObstacleId: blocker?.id,
        });
      }
    }
  }
  return candidates;
}
