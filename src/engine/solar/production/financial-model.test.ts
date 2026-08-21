import { describe, expect, it } from "vitest";
import { calculateFinancialValue } from "./financial-model";

describe("financial optimization", () => {
  it("calculates savings, payback, and discounted NPV", () => {
    const result = calculateFinancialValue({
      annualKwh: 5000,
      systemCostUsd: 12000,
      electricityRateUsdPerKwh: 0.25,
      annualOpexUsd: 100,
      incentiveUsd: 2000,
      annualDegradationRate: 0.005,
      analysisYears: 20,
      discountRate: 0.06,
    });

    expect(result.initialNetCostUsd).toBe(10000);
    expect(result.firstYearSavingsUsd).toBe(1150);
    expect(result.annualSavingsUsd).toHaveLength(20);
    expect(result.paybackYears).toBeDefined();
    expect(result.npvUsd).toBeGreaterThan(0);
  });

  it("clamps invalid production and financial inputs safely", () => {
    const result = calculateFinancialValue({
      annualKwh: -100,
      systemCostUsd: -500,
      electricityRateUsdPerKwh: -1,
      annualDegradationRate: 2,
      analysisYears: 0,
      discountRate: -1,
    });

    expect(result.initialNetCostUsd).toBe(0);
    expect(result.firstYearSavingsUsd).toBe(0);
    expect(result.annualSavingsUsd).toHaveLength(1);
    expect(result.npvUsd).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("normalizes incentives into the initial project cost", () => {
    const result = calculateFinancialValue({
      annualKwh: 1000,
      systemCostUsd: 5000,
      electricityRateUsdPerKwh: 0.2,
      incentiveUsd: 6000,
      analysisYears: 10,
    });

    expect(result.initialNetCostUsd).toBe(0);
    expect(result.paybackYears).toBe(0);
  });
});
