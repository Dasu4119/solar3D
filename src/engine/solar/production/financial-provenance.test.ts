import { describe, expect, it } from "vitest";
import { buildFinancialRunProvenance } from "./financial-provenance";

describe("buildFinancialRunProvenance", () => {
  const input = {
    annualKwh: 12000,
    systemCostUsd: 18000,
    electricityRateUsdPerKwh: 0.18,
    analysisYears: 25,
  };
  const result = {
    initialNetCostUsd: 18000,
    firstYearSavingsUsd: 2160,
    annualSavingsUsd: [2160],
    npvUsd: 1000,
    warnings: [],
  };

  it("binds financial results to the source simulation and design version", () => {
    const provenance = buildFinancialRunProvenance({
      simulationRunId: "sim-1",
      designVersionId: "design-v1",
      sourceSimulationResultHash: "hash-1",
      engineVersion: "2026.08.p1.2",
      input,
      result,
    });

    expect(provenance.simulationRunId).toBe("sim-1");
    expect(provenance.designVersionId).toBe("design-v1");
    expect(provenance.sourceSimulationResultHash).toBe("hash-1");
    expect(provenance.engineName).toBe("solar3d-financial");
  });

  it("does not expose mutable references to caller input or result", () => {
    const provenance = buildFinancialRunProvenance({
      simulationRunId: "sim-1",
      designVersionId: "design-v1",
      sourceSimulationResultHash: "hash-1",
      engineVersion: "2026.08.p1.2",
      input,
      result,
    });

    expect(provenance.input).not.toBe(input);
    expect(provenance.result).not.toBe(result);
  });

  it.each([
    ["simulationRunId", { simulationRunId: "" }],
    ["designVersionId", { designVersionId: "" }],
    ["sourceSimulationResultHash", { sourceSimulationResultHash: "" }],
    ["engineVersion", { engineVersion: "" }],
  ])("rejects missing %s", (_, override) => {
    expect(() => buildFinancialRunProvenance({
      simulationRunId: "sim-1",
      designVersionId: "design-v1",
      sourceSimulationResultHash: "hash-1",
      engineVersion: "2026.08.p1.2",
      input,
      result,
      ...override,
    })).toThrow();
  });
});
