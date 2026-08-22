import { describe, expect, it } from "vitest";
import { getCommercialReadiness } from "./commercial-readiness";

describe("commercial output action prerequisites", () => {
  const base = { designFinalized: true, engineeringAccepted: true, simulationCompleted: true, financialCompleted: true, bomAvailable: false, proposalAvailable: false, simulationProvenance: "site_weather" as const, source: { projectId: "project-1", designVersionId: "design-1", financialRunId: "financial-1", bomRunId: null, proposalRunId: null } };
  it("enables BOM only with design and financial lineage", () => {
    expect(getCommercialReadiness(base).canGenerateBom).toBe(true);
    expect(getCommercialReadiness({ ...base, source: { ...base.source, financialRunId: null } }).canGenerateBom).toBe(false);
  });
  it("keeps proposal blocked until a matching BOM exists", () => {
    expect(getCommercialReadiness(base).canGenerateProposal).toBe(false);
    expect(getCommercialReadiness({ ...base, bomAvailable: true, source: { ...base.source, bomRunId: "bom-1" } }).canGenerateProposal).toBe(true);
  });
  it("blocks commercial actions for a non-finalized design", () => {
    const readiness = getCommercialReadiness({ ...base, designFinalized: false });
    expect(readiness.canGenerateBom).toBe(false); expect(readiness.canGenerateProposal).toBe(false);
  });
});
