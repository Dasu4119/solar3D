import { describe, expect, it } from "vitest";
import { calculateAnnualProduction } from "../production/annual-production";
import { GOLDEN_DESIGN, GOLDEN_EXPECTED } from "./golden-design";

describe("golden Solar3D design", () => {
  it("keeps the canonical fixture structurally complete", () => {
    expect(GOLDEN_DESIGN.geometrySchemaVersion).toBe(1);
    expect(GOLDEN_DESIGN.layout.panelCount).toBe(40);
    expect(GOLDEN_DESIGN.electrical.panelsPerString * GOLDEN_DESIGN.electrical.stringCount).toBe(GOLDEN_DESIGN.layout.panelCount);
    expect(GOLDEN_DESIGN.electrical.mpptNumbers).toEqual([1, 2]);
    expect(GOLDEN_DESIGN.inverter.mpptCount).toBe(2);
  });

  it("locks the production regression result", () => {
    const result = calculateAnnualProduction({
      panelCount: GOLDEN_DESIGN.layout.panelCount,
      panelPowerWatts: GOLDEN_DESIGN.module.powerW,
      performanceRatio: GOLDEN_DESIGN.production.performanceRatio,
      annualSpecificYieldKwhPerKwp: GOLDEN_DESIGN.production.annualSpecificYieldKwhPerKwp,
      shadedEnergyFraction: GOLDEN_DESIGN.production.shadedEnergyFraction,
    });

    expect(result.dcCapacityKwp).toBe(GOLDEN_EXPECTED.dcCapacityKwp);
    expect(result.annualKwh).toBeCloseTo(GOLDEN_EXPECTED.annualKwh, 9);
    expect(result.shadingLossPct).toBe(GOLDEN_EXPECTED.shadingLossPct);
    expect(result.performanceRatio).toBe(GOLDEN_EXPECTED.performanceRatio);
    expect(result.specificYieldKwhPerKwp).toBe(GOLDEN_EXPECTED.specificYieldKwhPerKwp);
    expect(result.monthlyKwh).toHaveLength(GOLDEN_EXPECTED.monthlyKwh.length);
    result.monthlyKwh.forEach((value, index) => {
      expect(value).toBeCloseTo(GOLDEN_EXPECTED.monthlyKwh[index], 9);
    });
    expect(result.warnings).toEqual([]);
  });
});
