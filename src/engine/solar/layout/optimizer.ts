import { generateLayoutCandidates } from "./generator";
import { analyzeRoofPlane } from "./roof-planes";
import { panelFootprint, polygonsIntersect } from "./obstacles";
import type { LayoutCandidate, LayoutRequest, SolarLayoutResult } from "./types";

function placementBounds(candidate: LayoutCandidate, request: LayoutRequest) {
  const footprint = panelFootprint(
    candidate.placement.center,
    request.panel.widthM,
    request.panel.lengthM,
    candidate.placement.rotation,
  );
  return footprint;
}

function overlapsWithGap(a: LayoutCandidate, b: LayoutCandidate, request: LayoutRequest): boolean {
  const gap = Math.max(request.constraints?.panelGapM ?? 0, 0);
  if (gap === 0) return polygonsIntersect(placementBounds(a, request), placementBounds(b, request));

  const expand = (points: ReturnType<typeof panelFootprint>) => {
    const minX = Math.min(...points.map((p) => p.x)) - gap / 2;
    const maxX = Math.max(...points.map((p) => p.x)) + gap / 2;
    const minY = Math.min(...points.map((p) => p.y)) - gap / 2;
    const maxY = Math.max(...points.map((p) => p.y)) + gap / 2;
    return [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ];
  };

  return polygonsIntersect(
    expand(placementBounds(a, request)),
    expand(placementBounds(b, request)),
  );
}

function selectDeterministicPacking(candidates: LayoutCandidate[], request: LayoutRequest): LayoutCandidate[] {
  const selected: LayoutCandidate[] = [];
  const ordered = candidates
    .filter((candidate) => candidate.valid)
    .slice()
    .sort((a, b) =>
      b.score - a.score ||
      a.placement.center.y - b.placement.center.y ||
      a.placement.center.x - b.placement.center.x ||
      a.placement.rotation - b.placement.rotation ||
      a.placement.id.localeCompare(b.placement.id),
    );

  for (const candidate of ordered) {
    if (selected.every((other) => !overlapsWithGap(candidate, other, request))) {
      selected.push(candidate);
    }
  }
  return selected;
}

export function generateSolarLayout(request: LayoutRequest): SolarLayoutResult {
  const candidates = generateLayoutCandidates(
    request.roof,
    request.panel,
    request.constraints,
    request.existingPlacements,
    request.roofRegions,
    request.roofPlanes,
    request.usableRoofRegions,
  );
  const selected = selectDeterministicPacking(candidates, request);
  const placements = selected.map((candidate) => candidate.placement);
  const planeSummaries = request.roofPlanes?.map((plane) => {
    const analysis = analyzeRoofPlane(plane);
    const count = selected.filter((candidate) => candidate.roofPlaneId === plane.id).length;
    return {
      roofPlaneId: plane.id,
      pitchDeg: analysis.pitchDeg,
      azimuthDeg: analysis.azimuthDeg,
      placementCount: count,
      dcCapacityWatts: count * request.panel.powerWatts,
    };
  });
  return {
    placements,
    candidateCount: candidates.length,
    dcCapacityWatts: placements.length * request.panel.powerWatts,
    score: placements.length * request.panel.powerWatts,
    planeSummaries,
  };
}
