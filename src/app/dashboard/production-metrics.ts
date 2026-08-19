import { calculateAnnualProduction } from "@/engine/solar/production/annual-production";

export interface DashboardProductionSource {
  panelCount?: number;
  panelPowerWatts?: number;
  performanceRatio?: number;
  annualSpecificYieldKwhPerKwp?: number;
  monthlyYieldFraction?: number[];
  shadedEnergyFraction?: number;
}

export function getDashboardProductionMetrics(source: DashboardProductionSource) {
  if (!Number.isFinite(source.panelCount) || !Number.isFinite(source.panelPowerWatts) || (source.panelCount ?? 0) <= 0 || (source.panelPowerWatts ?? 0) <= 0) {
    return null;
  }

  return calculateAnnualProduction({
    panelCount: source.panelCount!,
    panelPowerWatts: source.panelPowerWatts!,
    performanceRatio: source.performanceRatio,
    annualSpecificYieldKwhPerKwp: source.annualSpecificYieldKwhPerKwp,
    monthlyYieldFraction: source.monthlyYieldFraction,
    shadedEnergyFraction: source.shadedEnergyFraction,
  });
}
