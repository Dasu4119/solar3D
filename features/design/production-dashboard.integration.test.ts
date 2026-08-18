import { describe, expect, it } from "vitest";
import { createProductionDashboardMetrics } from "./production-dashboard";

describe("production dashboard integration contract", () => {
  it("preserves verified design metrics and leaves unavailable simulation values unset", () => {
    const metrics = createProductionDashboardMetrics({
      panelCount: 12,
      panelWattage: 500,
      roofAreaM2: 120,
      usableRoofAreaM2: 90,
      annualKwh: undefined,
      shadingLossPercent: undefined,
    });

    expect(metrics.panelCount).toBe(12);
    expect(metrics.dcCapacityKwp).toBe(6);
    expect(metrics.roofUtilizationPercent).toBe(75);
    expect(metrics.annualKwh).toBeUndefined();
    expect(metrics.shadingLossPercent).toBeUndefined();
  });
});
