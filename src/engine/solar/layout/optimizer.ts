import { generateLayoutCandidates } from "./generator";
import type { LayoutRequest, SolarLayoutResult } from "./types";

export function generateSolarLayout(request: LayoutRequest): SolarLayoutResult {
  const candidates = generateLayoutCandidates(
    request.roof,
    request.panel,
    request.constraints,
    request.existingPlacements,
  );
  const placements = candidates.filter((candidate) => candidate.valid).map((candidate) => candidate.placement);
  return {
    placements,
    candidateCount: candidates.length,
    dcCapacityWatts: placements.length * request.panel.powerWatts,
    score: placements.reduce((sum, placement) => sum + request.panel.powerWatts, 0),
  };
}
