export interface AnnualProductionInput {
  panelCount: number;
  panelPowerWatts: number;
  performanceRatio?: number;
  annualSpecificYieldKwhPerKwp?: number;
  monthlyYieldFraction?: number[];
  shadedEnergyFraction?: number;
}

export interface AnnualProductionResult {
  dcCapacityKwp: number;
  annualKwh: number;
  monthlyKwh: number[];
  shadingLossPct: number;
  performanceRatio: number;
  specificYieldKwhPerKwp: number;
  warnings: string[];
}

const DEFAULT_SPECIFIC_YIELD = 1400;
const DEFAULT_PR = 0.82;
const DEFAULT_MONTHLY_FRACTIONS = [0.075, 0.07, 0.08, 0.085, 0.09, 0.095, 0.1, 0.1, 0.09, 0.085, 0.07, 0.06];

function normalizedFractions(input: number[] | undefined): number[] {
  const values = input?.length === 12 ? input.map((v) => Math.max(0, Number.isFinite(v) ? v : 0)) : DEFAULT_MONTHLY_FRACTIONS;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total > 0 ? values.map((value) => value / total) : DEFAULT_MONTHLY_FRACTIONS;
}

export function calculateAnnualProduction(input: AnnualProductionInput): AnnualProductionResult {
  const warnings: string[] = [];
  const panelCount = Math.max(0, Math.floor(Number.isFinite(input.panelCount) ? input.panelCount : 0));
  const panelPowerWatts = Math.max(0, Number.isFinite(input.panelPowerWatts) ? input.panelPowerWatts : 0);
  const performanceRatio = Math.min(1, Math.max(0, Number.isFinite(input.performanceRatio ?? DEFAULT_PR) ? (input.performanceRatio ?? DEFAULT_PR) : DEFAULT_PR));
  const specificYield = Math.max(0, Number.isFinite(input.annualSpecificYieldKwhPerKwp ?? DEFAULT_SPECIFIC_YIELD) ? (input.annualSpecificYieldKwhPerKwp ?? DEFAULT_SPECIFIC_YIELD) : DEFAULT_SPECIFIC_YIELD);
  const shaded = Math.min(1, Math.max(0, Number.isFinite(input.shadedEnergyFraction ?? 0) ? (input.shadedEnergyFraction ?? 0) : 0));

  if (panelCount === 0 || panelPowerWatts === 0) warnings.push("No active panel capacity");
  if (input.annualSpecificYieldKwhPerKwp == null) warnings.push("Using reference specific yield; replace with site/weather data for a bankable estimate");
  if (input.shadedEnergyFraction == null) warnings.push("No shading simulation supplied");

  const dcCapacityKwp = (panelCount * panelPowerWatts) / 1000;
  const grossAnnualKwh = dcCapacityKwp * specificYield * performanceRatio;
  const annualKwh = grossAnnualKwh * (1 - shaded);
  const fractions = normalizedFractions(input.monthlyYieldFraction);
  const monthlyKwh = fractions.map((fraction) => annualKwh * fraction);

  return {
    dcCapacityKwp,
    annualKwh,
    monthlyKwh,
    shadingLossPct: shaded * 100,
    performanceRatio,
    specificYieldKwhPerKwp: specificYield,
    warnings,
  };
}
