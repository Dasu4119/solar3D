import { invokeFunction } from "@/shared/api/client";

export interface EnergyRequest { designVersionId: string; }
export interface EnergyResult {
  annualKwh: number;
  monthlyKwh?: number[];
  performanceRatio?: number;
  warnings?: string[];
}

export function simulateEnergy(body: EnergyRequest) {
  return invokeFunction<EnergyResult>("solar-energy-simulation", body);
}
