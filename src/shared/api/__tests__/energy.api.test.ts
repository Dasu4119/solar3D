import { describe, expect, it, vi } from "vitest";
import { simulateEnergy } from "@/shared/api/energy.api";

const invoke = vi.fn();

vi.mock("@/shared/api/client", () => ({
  invokeFunction: (...args: unknown[]) => invoke(...args),
}));

describe("energy API provenance contract", () => {
  it("maps the frontend request to the persisted simulation contract", async () => {
    invoke.mockResolvedValueOnce({
      success: true,
      design_version_id: "version-1",
      simulation_run: {
        id: "run-1",
        run_number: 1,
        engine_name: "solar3d-production",
        engine_version: "2026.08.p0.1",
        input_hash: "input-hash",
        result_hash: "result-hash",
        created_at: "2026-08-19T00:00:00Z",
        completed_at: "2026-08-19T00:00:01Z",
      },
      engine: { name: "solar3d-production", version: "2026.08.p0.1" },
      assumptions: {
        annual_irradiance_kwh_m2: 1700,
        performance_ratio: 0.8,
        annual_degradation_percent: 0.5,
        years: 25,
      },
      summary: { dc_capacity_kw: 10, year_1_energy_kwh: 13600, lifetime_energy_kwh: 295000 },
      monthly: [],
      annual: [],
    });

    const result = await simulateEnergy({
      designVersionId: "version-1",
      annualIrradianceKwhM2: 1700,
      performanceRatio: 0.8,
      annualDegradationPercent: 0.5,
      years: 25,
    });

    expect(invoke).toHaveBeenCalledWith("solar-energy-simulation", {
      design_version_id: "version-1",
      annual_irradiance_kwh_m2: 1700,
      performance_ratio: 0.8,
      annual_degradation_percent: 0.5,
      years: 25,
    });
    expect(result.simulation_run.engine_version).toBe("2026.08.p0.1");
    expect(result.simulation_run.input_hash).toBe("input-hash");
    expect(result.simulation_run.result_hash).toBe("result-hash");
  });
});
