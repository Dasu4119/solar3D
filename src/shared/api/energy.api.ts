import { invokeFunction } from "@/shared/api/client";

export interface EnergyRequest {
  designVersionId: string;
  annualIrradianceKwhM2?: number;
  performanceRatio?: number;
  annualDegradationPercent?: number;
  years?: number;
}

export interface SimulationRunProvenance {
  id: string;
  run_number: number;
  engine_name: string;
  engine_version: string;
  input_hash: string;
  result_hash: string;
  created_at: string;
  completed_at: string | null;
}

export interface EnergyResult {
  success: boolean;
  design_version_id: string;
  simulation_run: SimulationRunProvenance;
  engine: { name: string; version: string };
  assumptions: {
    annual_irradiance_kwh_m2: number;
    performance_ratio: number;
    annual_degradation_percent: number;
    years: number;
  };
  summary: {
    dc_capacity_kw: number;
    year_1_energy_kwh: number;
    lifetime_energy_kwh: number;
  };
  monthly: Array<{ month: number; energy_kwh: number }>;
  annual: Array<{ year: number; energy_kwh: number }>;
}

export function simulateEnergy(body: EnergyRequest) {
  return invokeFunction<EnergyResult>("solar-energy-simulation", {
    design_version_id: body.designVersionId,
    ...(body.annualIrradianceKwhM2 === undefined
      ? {}
      : { annual_irradiance_kwh_m2: body.annualIrradianceKwhM2 }),
    ...(body.performanceRatio === undefined ? {} : { performance_ratio: body.performanceRatio }),
    ...(body.annualDegradationPercent === undefined
      ? {}
      : { annual_degradation_percent: body.annualDegradationPercent }),
    ...(body.years === undefined ? {} : { years: body.years }),
  });
}
