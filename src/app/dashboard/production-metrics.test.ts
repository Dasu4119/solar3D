import { describe, expect, it } from "vitest";
import { getDashboardProductionMetrics } from "./production-metrics";

describe("dashboard production metrics", () => {
  it("uses the validated engine for projects with production inputs", () => {
    const result = getDashboardProductionMetrics({
      panelCount: 20,
      panelPowerWatts: 500,
      annualSpecificYieldKwhPerKwp: 1500,
      performanceRatio: 0.8,
      shadedEnergyFraction: 0.1,
    });

    expect(result?.dcCapacityKwp).toBe(10);
    expect(result?.annualKwh).toBe(10800);
    expect(result?.monthlyKwh).toHaveLength(12);
    expect(result?.shadingLossPct).toBe(10);
  });

  it("does not invent production for projects without panel inputs", () => {
    expect(getDashboardProductionMetrics({})).toBeNull();
  });
});
