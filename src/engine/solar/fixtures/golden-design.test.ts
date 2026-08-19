import { describe, expect, it } from "vitest";
import { calculateAnnualProduction } from "../production/annual-production";
import {
  engineeringEnergyEqual,
  ENERGY_DISPLAY_DECIMALS,
  ENERGY_REGRESSION_TOLERANCE_KWH,
  roundEngineeringEnergyKwh,
} from "../precision/engineering-precision";
import { GOLDEN_DESIGN, GOLDEN_EXPECTED } from "./golden-design";

describe("golden Solar3D design", () => {
  it("keeps the canonical fixture structurally complete", () => {
    expect(GOLDEN_DESIGN.geometrySchemaVersion).toBe(1);
    expect(GOLDEN_DESIGN.layout.panelCount).toBe(40);
    expect(GOLDEN_DESIGN.electrical.panelsPerString * GOLDEN_DESIGN.electrical.stringCount).toBe(GOLDEN_DESIGN.layout.panelCount);
    expect(GOLDEN_DESIGN.electrical.mpptNumbers).toEqual([1, 2]);
    expect(GOLDEN_DESIGN.inverter.mpptCount).toBe(2);
  });

  it("locks the production regression result using the engineering precision policy", () => {
    const result = calculateAnnualProduction({
      panelCount: GOLDEN_DESIGN.layout.panelCount,
      panelPowerWatts: GOLDEN_DESIGN.module.powerW,
      performanceRatio: GOLDEN_DESIGN.production.performanceRatio,
      annualSpecificYieldKwhPerKwp: GOLDEN_DESIGN.production.annualSpecificYieldKwhPerKwp,
      shadedEnergyFraction: GOLDEN_DESIGN.production.shadedEnergyFraction,
    });

    expect(result.dcCapacityKwp).toBe(GOLDEN_EXPECTED.dcCapacityKwp);
    expect(engineeringEnergyEqual(result.annualKwh, GOLDEN_EXPECTED.annualKwh)).toBe(true);
    expect(result.shadingLossPct).toBe(GOLDEN_EXPECTED.shadingLossPct);
    expect(result.performanceRatio).toBe(GOLDEN_EXPECTED.performanceRatio);
    expect(result.specificYieldKwhPerKwp).toBe(GOLDEN_EXPECTED.specificYieldKwhPerKwp);
    expect(result.monthlyKwh).toHaveLength(GOLDEN_EXPECTED.monthlyKwh.length);
    result.monthlyKwh.forEach((value, index) => {
      expect(engineeringEnergyEqual(value, GOLDEN_EXPECTED.monthlyKwh[index])).toBe(true);
    });
    expect(result.warnings).toEqual([]);
  });

  it("defines stable engineering-energy presentation semantics", () => {
    expect(ENERGY_DISPLAY_DECIMALS).toBe(2);
    expect(ENERGY_REGRESSION_TOLERANCE_KWH).toBe(0.01);
    expect(roundEngineeringEnergyKwh(1374.1560000000002)).toBe(1374.16);
    expect(roundEngineeringEnergyKwh(1668.6180000000002)).toBe(1668.62);
  });
});
