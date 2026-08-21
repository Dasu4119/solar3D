export interface FinancialOptimizationInput {
  annualKwh: number;
  systemCostUsd: number;
  electricityRateUsdPerKwh: number;
  annualOpexUsd?: number;
  incentiveUsd?: number;
  annualDegradationRate?: number;
  analysisYears?: number;
  discountRate?: number;
}

export interface FinancialOptimizationResult {
  initialNetCostUsd: number;
  firstYearSavingsUsd: number;
  annualSavingsUsd: number[];
  paybackYears?: number;
  npvUsd: number;
  warnings: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function calculateFinancialValue(input: FinancialOptimizationInput): FinancialOptimizationResult {
  const warnings: string[] = [];
  const annualKwh = Math.max(0, Number.isFinite(input.annualKwh) ? input.annualKwh : 0);
  const systemCostUsd = Math.max(0, Number.isFinite(input.systemCostUsd) ? input.systemCostUsd : 0);
  const rate = Math.max(0, Number.isFinite(input.electricityRateUsdPerKwh) ? input.electricityRateUsdPerKwh : 0);
  const opex = Math.max(0, Number.isFinite(input.annualOpexUsd ?? 0) ? input.annualOpexUsd ?? 0 : 0);
  const incentive = Math.max(0, Number.isFinite(input.incentiveUsd ?? 0) ? input.incentiveUsd ?? 0 : 0);
  const degradation = clamp(Number.isFinite(input.annualDegradationRate ?? 0) ? input.annualDegradationRate ?? 0 : 0, 0, 1);
  const years = Math.max(1, Math.floor(Number.isFinite(input.analysisYears ?? 25) ? input.analysisYears ?? 25 : 25));
  const discountRate = clamp(Number.isFinite(input.discountRate ?? 0) ? input.discountRate ?? 0 : 0, 0, 1);

  if (annualKwh === 0) warnings.push("No annual production supplied; financial value is zero");
  if (rate === 0) warnings.push("No electricity tariff supplied; savings are zero");
  if (input.incentiveUsd == null) warnings.push("No incentive supplied");

  const initialNetCostUsd = Math.max(0, systemCostUsd - incentive);
  const annualSavingsUsd: number[] = [];
  let cumulative = -initialNetCostUsd;
  let paybackYears: number | undefined;
  let npvUsd = -initialNetCostUsd;

  for (let year = 1; year <= years; year += 1) {
    const yearKwh = annualKwh * Math.pow(1 - degradation, year - 1);
    const netSavings = Math.max(0, yearKwh * rate - opex);
    annualSavingsUsd.push(netSavings);
    cumulative += netSavings;
    npvUsd += netSavings / Math.pow(1 + discountRate, year);

    if (paybackYears == null && cumulative >= 0) {
      const previousCumulative = cumulative - netSavings;
      paybackYears = netSavings > 0
        ? (year - 1) + Math.max(0, -previousCumulative) / netSavings
        : year;
    }
  }

  return {
    initialNetCostUsd,
    firstYearSavingsUsd: annualSavingsUsd[0] ?? 0,
    annualSavingsUsd,
    paybackYears,
    npvUsd,
    warnings,
  };
}
