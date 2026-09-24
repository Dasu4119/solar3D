import { describe, expect, it } from "vitest";
import { getCommercialReadiness } from "./commercial-readiness";

describe("getCommercialReadiness", () => {
  it("blocks BOM and proposal until engineering, simulation, and financial gates pass", () => {
    const result = getCommercialReadiness({
      designFinalized: true,
      engineeringAccepted: false,
      simulationCompleted: true,
      financialCompleted: false,
      bomAvailable: false,
      proposalAvailable: false,
      simulationProvenance: "site_weather",
    });

    expect(result.status).toBe("blocked");
    expect(result.canGenerateBom).toBe(false);
    expect(result.canGenerateProposal).toBe(false);
    expect(result.blockers).toHaveLength(2);
  });

  it("allows BOM but not proposal until a BOM snapshot exists", () => {
    const result = getCommercialReadiness({
      designFinalized: true,
      engineeringAccepted: true,
      simulationCompleted: true,
      financialCompleted: true,
      bomAvailable: false,
      proposalAvailable: false,
      simulationProvenance: "site_weather",
    });

    expect(result.status).toBe("ready");
    expect(result.canGenerateBom).toBe(true);
    expect(result.canGenerateProposal).toBe(false);
  });

  it("surfaces the reference-yield warning without pretending the estimate is bankable", () => {
    const result = getCommercialReadiness({
      designFinalized: true,
      engineeringAccepted: true,
      simulationCompleted: true,
      financialCompleted: true,
      bomAvailable: true,
      proposalAvailable: false,
      simulationProvenance: "reference",
    });

    expect(result.status).toBe("warning");
    expect(result.provenanceLabel).toBe("Reference estimate");
    expect(result.warnings[0]).toContain("not a bankable");
    expect(result.canGenerateProposal).toBe(true);
  });

  it("returns a fully ready state when all lineage gates are present", () => {
    const result = getCommercialReadiness({
      designFinalized: true,
      engineeringAccepted: true,
      simulationCompleted: true,
      financialCompleted: true,
      bomAvailable: true,
      proposalAvailable: true,
      simulationProvenance: "site_weather",
    });

    expect(result.status).toBe("ready");
    expect(result.blockers).toEqual([]);
    expect(result.canGenerateBom).toBe(true);
    expect(result.canGenerateProposal).toBe(true);
  });
});
