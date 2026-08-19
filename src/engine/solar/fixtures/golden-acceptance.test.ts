import { describe, expect, it } from "vitest";
import { GOLDEN_DESIGN, GOLDEN_EXPECTED } from "./golden-design";
import { calculateAnnualProduction } from "../production/annual-production";

describe("P0.11 golden acceptance regression", () => {
  it("matches the engineering acceptance prerequisites", () => {
    expect(GOLDEN_DESIGN.geometrySchemaVersion).toBe(1);
    expect(GOLDEN_DESIGN.layout.panelCount).toBe(
      GOLDEN_DESIGN.electrical.stringCount * GOLDEN_DESIGN.electrical.panelsPerString,
    );
    expect(GOLDEN_DESIGN.electrical.mpptNumbers).toEqual([1, 2]);
    expect(GOLDEN_DESIGN.electrical.mpptNumbers.every((n) => n >= 1 && n <= GOLDEN_DESIGN.inverter.mpptCount)).toBe(true);

    const dcCapacityKwp = (GOLDEN_DESIGN.layout.panelCount * GOLDEN_DESIGN.module.powerW) / 1000;
    expect(dcCapacityKwp).toBe(GOLDEN_EXPECTED.dcCapacityKwp);
    expect(dcCapacityKwp / GOLDEN_DESIGN.inverter.ratedPowerKw).toBeGreaterThan(0.8);
    expect(dcCapacityKwp / GOLDEN_DESIGN.inverter.ratedPowerKw).toBeLessThan(1.5);

    const coldVocV = GOLDEN_DESIGN.module.vocV * GOLDEN_DESIGN.electrical.panelsPerString *
      (1 + 0.0029 * (25 - GOLDEN_DESIGN.electrical.coldTempC));
    const hotVmpV = GOLDEN_DESIGN.module.vmpV * GOLDEN_DESIGN.electrical.panelsPerString *
      (1 - 0.0029 * (GOLDEN_DESIGN.electrical.hotTempC - 25));

    expect(coldVocV).toBeLessThan(GOLDEN_DESIGN.inverter.maxVoltageV);
    expect(hotVmpV).toBeGreaterThan(GOLDEN_DESIGN.inverter.mpptMinVoltageV);
    expect(hotVmpV).toBeLessThan(GOLDEN_DESIGN.inverter.mpptMaxVoltageV);
    expect(GOLDEN_DESIGN.module.impA).toBeLessThan(GOLDEN_DESIGN.inverter.maxCurrentA);
  });

  it("locks the production output used by the acceptance fixture", () => {
    const result = calculateAnnualProduction({
      panelCount: GOLDEN_DESIGN.layout.panelCount,
      panelPowerWatts: GOLDEN_DESIGN.module.powerW,
      performanceRatio: GOLDEN_DESIGN.production.performanceRatio,
      annualSpecificYieldKwhPerKwp: GOLDEN_DESIGN.production.annualSpecificYieldKwhPerKwp,
      shadedEnergyFraction: GOLDEN_DESIGN.production.shadedEnergyFraction,
    });

    expect(result).toMatchObject({
      dcCapacityKwp: GOLDEN_EXPECTED.dcCapacityKwp,
      annualKwh: GOLDEN_EXPECTED.annualKwh,
      shadingLossPct: GOLDEN_EXPECTED.shadingLossPct,
      performanceRatio: GOLDEN_EXPECTED.performanceRatio,
      specificYieldKwhPerKwp: GOLDEN_EXPECTED.specificYieldKwhPerKwp,
      monthlyKwh: GOLDEN_EXPECTED.monthlyKwh,
      warnings: [],
    });
  });
});
