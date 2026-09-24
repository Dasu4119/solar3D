import { describe, expect, it } from "vitest";
import { getCommercialReadiness } from "./commercial-readiness";

describe("commercial readiness integration contract", () => {
  it("blocks every commercial output when the active engineering version is not accepted", () => {
    const readiness = getCommercialReadiness({
      designFinalized: true,
      engineeringAccepted: false,
      simulationCompleted: true,
      financialCompleted: true,
      bomAvailable: false,
      proposalAvailable: false,
      simulationProvenance: "site_weather",
    });
    expect(readiness.status).toBe("blocked");
    expect(readiness.canGenerateBom).toBe(false);
    expect(readiness.canGenerateProposal).toBe(false);
  });

  it("keeps reference production visibly classified as a warning", () => {
    const readiness = getCommercialReadiness({
      designFinalized: true,
      engineeringAccepted: true,
      simulationCompleted: true,
      financialCompleted: true,
      bomAvailable: true,
      proposalAvailable: false,
      simulationProvenance: "reference",
    });
    expect(readiness.provenanceLabel).toBe("Reference estimate");
    expect(readiness.status).toBe("warning");
    expect(readiness.warnings.some((warning) => warning.includes("not a bankable"))).toBe(true);
  });
});
