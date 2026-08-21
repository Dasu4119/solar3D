import { calculateAnnualProduction } from "../production/annual-production";
import { calculateFinancialValue } from "../production/financial-model";
import { generateLayoutCandidates } from "./generator";
import { analyzeRoofPlane } from "./roof-planes";
import type { LayoutCandidate, LayoutRequest, SolarLayoutResult } from "./types";

const DEG_TO_RAD = Math.PI / 180;

function angularDistanceDeg(a: number, b: number): number {
  return Math.abs(((a - b + 180) % 360 + 360) % 360 - 180);
}

function orientationFactor(actual: number, preferred: number | undefined): number {
  if (preferred == null || !Number.isFinite(preferred)) return 1;
  return 0.55 + 0.45 * Math.max(0, Math.cos(angularDistanceDeg(actual, preferred) * DEG_TO_RAD));
}

function pitchFactor(actual: number, preferred: number | undefined): number {
  if (preferred == null || !Number.isFinite(preferred)) return 1;
  return 0.8 + 0.2 * Math.max(0, Math.cos((actual - preferred) * DEG_TO_RAD));
}

function estimateGroupAnnualKwh(group: LayoutCandidate[], request: LayoutRequest): number {
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

function estimateGroupFinancialNpv(group: LayoutCandidate[], request: LayoutRequest): number {
  const financial = request.financialObjective;
  if (!financial) return -Infinity;
  const annualKwh = estimateGroupAnnualKwh(group, request);
  const variableCost = Math.max(0, financial.systemCostUsdPerWatt ?? 0) * group.length * request.panel.powerWatts;
  const fixedCost = Math.max(0, financial.systemCostUsd ?? 0);
  return calculateFinancialValue({
    annualKwh,
    systemCostUsd: fixedCost + variableCost,
    electricityRateUsdPerKwh: financial.electricityRateUsdPerKwh,
    annualOpexUsd: financial.annualOpexUsd,
    incentiveUsd: financial.incentiveUsd,
    annualDegradationRate: financial.annualDegradationRate,
    analysisYears: financial.analysisYears,
    discountRate: financial.discountRate,
  }).npvUsd;
}

function selectOptimalCandidates(candidates: LayoutCandidate[], request: LayoutRequest): LayoutCandidate[] {
  if (!request.productionObjective && !request.financialObjective) return candidates.filter((candidate) => candidate.valid);

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
    let bestScore = -Infinity;
    for (const group of regionGroups) {
      const score = request.financialObjective
        ? estimateGroupFinancialNpv(group, request)
        : estimateGroupAnnualKwh(group, request);
      const rotation = group[0]?.placement.rotation ?? Infinity;
      const bestRotation = bestGroup?.[0]?.placement.rotation ?? Infinity;
      if (score > bestScore || (Math.abs(score - bestScore) < 1e-9 && rotation < bestRotation)) {
        bestScore = score;
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
  const valid = selectOptimalCandidates(candidates, request);
  const placements = valid.map((candidate) => candidate.placement);
  const hasValueObjective = Boolean(request.productionObjective || request.financialObjective);
  const groupKeys = hasValueObjective
    ? [...new Set(valid.map((candidate) => `${candidate.regionKey ?? candidate.roofPlaneId ?? "region"}|${candidate.placement.rotation}`))]
    : [];
  const estimatedAnnualKwh = hasValueObjective
    ? groupKeys.reduce((sum, key) => {
        const [regionKey, rotation] = key.split("|");
        const group = valid.filter((candidate) =>
          (candidate.regionKey ?? candidate.roofPlaneId ?? "region") === regionKey
          && candidate.placement.rotation === Number(rotation),
        );
        return sum + estimateGroupAnnualKwh(group, request);
      }, 0)
    : undefined;

  const estimatedFinancial = request.financialObjective
    ? calculateFinancialValue({
        annualKwh: estimatedAnnualKwh ?? 0,
        systemCostUsd: request.financialObjective.systemCostUsd,
        systemCostUsdPerWatt: undefined,
        electricityRateUsdPerKwh: request.financialObjective.electricityRateUsdPerKwh,
        annualOpexUsd: request.financialObjective.annualOpexUsd,
        incentiveUsd: request.financialObjective.incentiveUsd,
        annualDegradationRate: request.financialObjective.annualDegradationRate,
        analysisYears: request.financialObjective.analysisYears,
        discountRate: request.financialObjective.discountRate,
      })
    : undefined;

  const variableCost = request.financialObjective
    ? Math.max(0, request.financialObjective.systemCostUsdPerWatt ?? 0) * placements.length * request.panel.powerWatts
    : 0;
  const fixedCost = request.financialObjective
    ? Math.max(0, request.financialObjective.systemCostUsd ?? 0)
    : 0;
  const totalFinancial = request.financialObjective
    ? calculateFinancialValue({
        annualKwh: estimatedAnnualKwh ?? 0,
        systemCostUsd: fixedCost + variableCost,
        electricityRateUsdPerKwh: request.financialObjective.electricityRateUsdPerKwh,
        annualOpexUsd: request.financialObjective.annualOpexUsd,
        incentiveUsd: request.financialObjective.incentiveUsd,
        annualDegradationRate: request.financialObjective.annualDegradationRate,
        analysisYears: request.financialObjective.analysisYears,
        discountRate: request.financialObjective.discountRate,
      })
    : estimatedFinancial;

  const planeSummaries = request.roofPlanes?.map((plane) => {
    const analysis = analyzeRoofPlane(plane);
    const planeCandidates = valid.filter((candidate) => candidate.roofPlaneId === plane.id);
    const count = planeCandidates.length;
    const planeAnnualKwh = hasValueObjective && count > 0
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
    score: request.financialObjective
      ? totalFinancial?.npvUsd ?? 0
      : request.productionObjective
        ? estimatedAnnualKwh ?? 0
        : placements.length * request.panel.powerWatts,
    estimatedAnnualKwh,
    estimatedNpvUsd: totalFinancial?.npvUsd,
    estimatedPaybackYears: totalFinancial?.paybackYears,
    planeSummaries,
  };
}
