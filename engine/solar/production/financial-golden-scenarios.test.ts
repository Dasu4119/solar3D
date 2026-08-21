import { describe, expect, it } from "vitest";
import { calculateFinancialValue } from "../../../src/engine/solar/production/financial-model";

describe("financial golden scenarios", () => {
  it("matches a financed residential baseline", () => {
    const result = calculateFinancialValue({
      annualKwh: 12000,
      systemCostUsd: 24000,
      electricityRateUsdPerKwh: 0.22,
      annualOpexUsd: 240,
      incentiveUsd: 4800,
      annualDegradationRate: 0.005,
      analysisYears: 25,
      discountRate: 0.06,
    });

    expect(result.initialNetCostUsd).toBeCloseTo(19200, 8);
    expect(result.firstYearSavingsUsd).toBeCloseTo(2400, 8);
    expect(result.paybackYears).toBeCloseTo(8.15936, 5);
    expect(result.npvUsd).toBeCloseTo(9998.64, 2);
    expect(result.annualSavingsUsd).toHaveLength(25);
  });

  it("shows the expected tariff sensitivity", () => {
    const lowTariff = calculateFinancialValue({
      annualKwh: 10000,
      systemCostUsd: 20000,
      electricityRateUsdPerKwh: 0.12,
      incentiveUsd: 4000,
      analysisYears: 20,
      discountRate: 0.05,
    });
    const highTariff = calculateFinancialValue({
      annualKwh: 10000,
      systemCostUsd: 20000,
      electricityRateUsdPerKwh: 0.30,
      incentiveUsd: 4000,
      analysisYears: 20,
      discountRate: 0.05,
    });

    expect(highTariff.npvUsd).toBeGreaterThan(lowTariff.npvUsd);
    expect(highTariff.paybackYears ?? Infinity).toBeLessThan(lowTariff.paybackYears ?? Infinity);
  });

  it("degrades production and cash savings deterministically", () => {
    const result = calculateFinancialValue({
      annualKwh: 10000,
      systemCostUsd: 10000,
      electricityRateUsdPerKwh: 0.20,
      incentiveUsd: 0,
      annualDegradationRate: 0.01,
      analysisYears: 3,
      discountRate: 0,
    });

    expect(result.annualSavingsUsd[0]).toBeCloseTo(2000, 8);
    expect(result.annualSavingsUsd[1]).toBeCloseTo(1980, 8);
    expect(result.annualSavingsUsd[2]).toBeCloseTo(1960.2, 8);
    expect(result.npvUsd).toBeCloseTo(-4059.8, 8);
  });
});
