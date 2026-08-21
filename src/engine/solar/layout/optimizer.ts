import { calculateAnnualProduction } from "../production/annual-production";
import { generateLayoutCandidates } from "./generator";
import { analyzeRoofPlane } from "./roof-planes";
import type { LayoutCandidate, LayoutRequest, SolarLayoutResult } from "./types";

const DEG_TO_RAD = Math.PI / 180;

function angularDistanceDeg(a: number, b: number): number {
  const delta = Math.abs(((a - b + 180) % 360 + 360) % 360 - 180);
  return delta;
}

function orientationFactor(actual: number, preferred: number | undefined): number {
  if (preferred == null || !Number.isFinite(preferred)) return 1;
  // A bounded orientation factor is intentionally conservative: it is an
  // optimization heuristic, not a bankable irradiance/shading simulation.
  return 0.7 + 0.3 * Math.max(0, Math.cos(angularDistanceDeg(actual, preferred) * DEG_TO_RAD));
}

function pitchFactor(actual: number, preferred: number | undefined): number {
  if (preferred == null || !Number.isFinite(preferred)) return 1;
  return 0.8 + 0.2 * Math.max(0, Math.cos((actual - preferred) * DEG_TO_RAD));
}

function estimateGroupAnnualKwh(
  group: LayoutCandidate[],
  request: LayoutRequest,
): number {
  const plane = request.roofPlanes?.find((candidate) => candidate.id === group[0]?.roofPlaneId);
  const pitch = plane?.pitchDeg ?? 0;
  const baseAzimuth = plane?.azimuthDeg ?? 0;
  const rotation = group[0]?.placement.rotation ?? 0;
  const panelAzimuth = baseAzimuth + rotation;
  const objective = request.productionObjective;
  const yieldFactor = orientationFactor(panelAzimuth, objective?.preferredAzimuthDeg)
    * pitchFactor(pitch, objective?.preferredPitchDeg);
  const production = calculateAnnualProduction({
    panelCount: group.length,
    panelPowerWatts: request.panel.powerWatts,
    annualSpecificYieldKwhPerKwp: objective?.annualSpecificYieldKwhPerKwp,
    performanceRatio: objective?.performanceRatio,
    shadedEnergyFraction: objective?.shadedEnergyFraction,
  });
  return production.annualKwh * yieldFactor;
}

function selectProductionOptimalCandidates(candidates: LayoutCandidate[], request: LayoutRequest): LayoutCandidate[] {
  if (!request.productionObjective) return candidates.filter((candidate) => candidate.valid);

  const groups = new Map<string, LayoutCandidate[]>();
  for (const candidate of candidates) {
    if (!candidate.valid) continue;
    const key = `${candidate.regionKey ?? candidate.roofPlaneId ?? "region"}|${candidate.placement.rotation}`;
    const group = groups.get(key) ?? [];
    group.push(candidate);
    groups.set(key, group);
  }

  const byRegion = new Map<string, LayoutCandidate[][]>();
  for (const group of groups.values()) {
    const regionKey = group[0]?.regionKey ?? group[0]?.roofPlaneId ?? "region";
    const regionGroups = byRegion.get(regionKey) ?? [];
    regionGroups.push(group);
    byRegion.set(regionKey, regionGroups);
  }

  const selected: LayoutCandidate[] = [];
  for (const regionGroups of byRegion.values()) {
    let bestGroup: LayoutCandidate[] | undefined;
    let bestKwh = -Infinity;
    for (const group of regionGroups) {
      const kwh = estimateGroupAnnualKwh(group, request);
      if (kwh > bestKwh || (Math.abs(kwh - bestKwh) < 1e-9 && group[0].placement.rotation < (bestGroup?.[0]?.placement.rotation ?? Infinity))) {
        bestKwh = kwh;
        bestGroup = group;
      }
    }
    if (bestGroup) selected.push(...bestGroup);
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
  const valid = selectProductionOptimalCandidates(candidates, request);
  const placements = valid.map((candidate) => candidate.placement);
  const estimatedAnnualKwh = request.productionObjective
    ? valid.reduce((sum, candidate) => {
        const group = valid.filter((other) =>
          (other.regionKey ?? other.roofPlaneId ?? "region") === (candidate.regionKey ?? candidate.roofPlaneId ?? "region")
          && other.placement.rotation === candidate.placement.rotation,
        );
        return sum + estimateGroupAnnualKwh(group, request) / Math.max(1, group.length);
      }, 0)
    : undefined;
  const planeSummaries = request.roofPlanes?.map((plane) => {
    const analysis = analyzeRoofPlane(plane);
    const planeCandidates = valid.filter((candidate) => candidate.roofPlaneId === plane.id);
    const count = planeCandidates.length;
    const planeAnnualKwh = request.productionObjective && count > 0
      ? estimateGroupAnnualKwh(planeCandidates, request)
      : undefined;
    return {
      roofPlaneId: plane.id,
      pitchDeg: analysis.pitchDeg,
      azimuthDeg: analysis.azimuthDeg,
      placementCount: count,
      dcCapacityWatts: count * request.panel.powerWatts,
      estimatedAnnualKwh: planeAnnualKwh,
    };
  });
  return {
    placements,
    candidateCount: candidates.length,
    dcCapacityWatts: placements.length * request.panel.powerWatts,
    score: request.productionObjective ? estimatedAnnualKwh ?? 0 : placements.length * request.panel.powerWatts,
    estimatedAnnualKwh,
    planeSummaries,
  };
}
