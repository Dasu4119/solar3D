import { generateLayoutCandidates } from "./generator";
import { analyzeRoofPlane } from "./roof-planes";
import type { LayoutRequest, SolarLayoutResult } from "./types";

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
  const valid = candidates.filter((candidate) => candidate.valid);
  const placements = valid.map((candidate) => candidate.placement);
  const planeSummaries = request.roofPlanes?.map((plane) => {
    const analysis = analyzeRoofPlane(plane);
    const count = valid.filter((candidate) => candidate.roofPlaneId === plane.id).length;
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
