import { describe, expect, it } from "vitest";
import { calculateAnnualProduction } from "./annual-production";

describe("annual production", () => {
  it("calculates capacity, annual energy, and monthly allocation", () => {
    const result = calculateAnnualProduction({
      panelCount: 10,
      panelPowerWatts: 400,
      performanceRatio: 0.8,
      annualSpecificYieldKwhPerKwp: 1500,
      shadedEnergyFraction: 0.1,
    });

    expect(result.dcCapacityKwp).toBe(4);
    expect(result.annualKwh).toBe(4320);
    expect(result.monthlyKwh).toHaveLength(12);
    expect(result.monthlyKwh.reduce((a, b) => a + b, 0)).toBeCloseTo(4320);
    expect(result.shadingLossPct).toBe(10);
  });

  it("never emits negative energy and safely handles missing inputs", () => {
    const result = calculateAnnualProduction({ panelCount: -2, panelPowerWatts: 400, shadedEnergyFraction: 2 });
    expect(result.dcCapacityKwp).toBe(0);
    expect(result.annualKwh).toBe(0);
    expect(result.monthlyKwh.every((value) => value === 0)).toBe(true);
    expect(result.shadingLossPct).toBe(100);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("normalizes a supplied monthly yield profile", () => {
    const result = calculateAnnualProduction({
      panelCount: 1,
      panelPowerWatts: 1000,
      annualSpecificYieldKwhPerKwp: 1000,
      performanceRatio: 1,
      monthlyYieldFraction: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    expect(result.monthlyKwh[0]).toBe(1000);
    expect(result.monthlyKwh.slice(1).every((value) => value === 0)).toBe(true);
  });
});
