import type { PanelPlacement } from "@/engine/solar/placement";
import type { SolarPanelSpec } from "@/engine/solar/panel";
import type { RoofPlane } from "@/engine/solar/layout/roof-planes";
import { estimateSolarProduction, type SolarProductionRequest } from "./production";
import type { IrradianceModel } from "./irradiance";
import type { OcclusionOptions, RoofObstaclePrism } from "./occlusion";

export interface AnnualProductionRequest {
  startDate: Date;
  endDate: Date;
  timestepMinutes?: number;
  latitudeDeg: number;
  longitudeDeg: number;
  panel: SolarPanelSpec;
  placements: PanelPlacement[];
  roofPlanes: RoofPlane[];
  placementRoofPlaneIds?: Record<string, string>;
  obstacles?: RoofObstaclePrism[];
  irradiance?: IrradianceModel;
  occlusion?: OcclusionOptions;
}

export interface MonthlyProductionSummary {
  month: number;
  dcEnergyWh: number;
  unshadedDcEnergyWh: number;
  peakDcPowerWatts: number;
  shadedIntervals: number;
}

export interface AnnualProductionResult {
  startDate: string;
  endDate: string;
  timestepMinutes: number;
  totalDcEnergyKWh: number;
  unshadedDcEnergyKWh: number;
  shadingLossKWh: number;
  shadingLossPercent: number;
  peakDcPowerWatts: number;
  simulatedIntervals: number;
  producingIntervals: number;
  monthly: MonthlyProductionSummary[];
}

const MIN_TIMESTEP_MINUTES = 5;
const MAX_TIMESTEP_MINUTES = 24 * 60;

function assertValidRequest(request: AnnualProductionRequest, timestepMinutes: number): void {
  if (!(request.startDate instanceof Date) || Number.isNaN(request.startDate.getTime())) {
    throw new Error("startDate must be a valid Date");
  }
  if (!(request.endDate instanceof Date) || Number.isNaN(request.endDate.getTime())) {
    throw new Error("endDate must be a valid Date");
  }
  if (request.endDate.getTime() <= request.startDate.getTime()) {
    throw new Error("endDate must be after startDate");
  }
  if (!Number.isInteger(timestepMinutes) || timestepMinutes < MIN_TIMESTEP_MINUTES || timestepMinutes > MAX_TIMESTEP_MINUTES) {
    throw new Error(`timestepMinutes must be an integer between ${MIN_TIMESTEP_MINUTES} and ${MAX_TIMESTEP_MINUTES}`);
  }
}

/**
 * Integrates the deterministic P1-D production pipeline over time.
 *
 * The simulator intentionally reuses estimateSolarProduction for every sample so
 * solar position, occlusion, irradiance, and panel power remain one canonical path.
 * Energy is accumulated with a zero-order hold over each timestep.
 */
export function estimateAnnualSolarProduction(request: AnnualProductionRequest): AnnualProductionResult {
  const timestepMinutes = request.timestepMinutes ?? 60;
  assertValidRequest(request, timestepMinutes);

  const monthly = Array.from({ length: 12 }, (_, month) => ({
    month: month + 1,
    dcEnergyWh: 0,
    unshadedDcEnergyWh: 0,
    peakDcPowerWatts: 0,
    shadedIntervals: 0,
  }));

  const stepMs = timestepMinutes * 60_000;
  const startMs = request.startDate.getTime();
  const endMs = request.endDate.getTime();
  let totalDcEnergyWh = 0;
  let unshadedDcEnergyWh = 0;
  let peakDcPowerWatts = 0;
  let simulatedIntervals = 0;
  let producingIntervals = 0;

  for (let timestampMs = startMs; timestampMs < endMs; timestampMs += stepMs) {
    const sampleEndMs = Math.min(timestampMs + stepMs, endMs);
    const intervalHours = (sampleEndMs - timestampMs) / 3_600_000;
    const date = new Date(timestampMs);
    const production = estimateSolarProduction({
      date,
      latitudeDeg: request.latitudeDeg,
      longitudeDeg: request.longitudeDeg,
      panel: request.panel,
      placements: request.placements,
      roofPlanes: request.roofPlanes,
      placementRoofPlaneIds: request.placementRoofPlaneIds,
      obstacles: request.obstacles,
      irradiance: request.irradiance,
      occlusion: request.occlusion,
    } satisfies SolarProductionRequest);

    const month = monthly[date.getUTCMonth()];
    const dcEnergy = production.totalDcPowerWatts * intervalHours;
    const unshadedEnergy = production.unshadedDcPowerWatts * intervalHours;

    totalDcEnergyWh += dcEnergy;
    unshadedDcEnergyWh += unshadedEnergy;
    peakDcPowerWatts = Math.max(peakDcPowerWatts, production.totalDcPowerWatts);
    simulatedIntervals += 1;

    if (production.totalDcPowerWatts > 0) {
      producingIntervals += 1;
    }
    if (production.averageShadeFraction > 0) {
      month.shadedIntervals += 1;
    }

    month.dcEnergyWh += dcEnergy;
    month.unshadedDcEnergyWh += unshadedEnergy;
    month.peakDcPowerWatts = Math.max(month.peakDcPowerWatts, production.totalDcPowerWatts);
  }

  const shadingLossWh = Math.max(0, unshadedDcEnergyWh - totalDcEnergyWh);
  const shadingLossPercent = unshadedDcEnergyWh > 0 ? (shadingLossWh / unshadedDcEnergyWh) * 100 : 0;

  return {
    startDate: request.startDate.toISOString(),
    endDate: request.endDate.toISOString(),
    timestepMinutes,
    totalDcEnergyKWh: totalDcEnergyWh / 1000,
    unshadedDcEnergyKWh: unshadedDcEnergyWh / 1000,
    shadingLossKWh: shadingLossWh / 1000,
    shadingLossPercent,
    peakDcPowerWatts,
    simulatedIntervals,
    producingIntervals,
    monthly,
  };
}
