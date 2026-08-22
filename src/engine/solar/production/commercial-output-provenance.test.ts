import { describe, expect, it } from "vitest";
import {
  buildBomOutputProvenance,
  buildProposalOutputProvenance,
} from "./commercial-output-provenance";

describe("commercial output provenance", () => {
  it("binds a BOM to its financial run and design version", () => {
    const input = { modules: [{ sku: "module-400w", quantity: 24 }] };
    const result = { totalModules: 24, totalCost: 7200 };
    const provenance = buildBomOutputProvenance({
      designVersionId: "design-v1",
      financialRunId: "financial-1",
      sourceFinancialResultHash: "financial-hash-1",
      input,
      result,
    });

    expect(provenance.designVersionId).toBe("design-v1");
    expect(provenance.financialRunId).toBe("financial-1");
    expect(provenance.input).not.toBe(input);
    expect(provenance.result).not.toBe(result);
  });

  it("binds a proposal to the BOM, financial run and design version", () => {
    const provenance = buildProposalOutputProvenance({
      designVersionId: "design-v1",
      financialRunId: "financial-1",
      bomRunId: "bom-1",
      sourceFinancialResultHash: "financial-hash-1",
      sourceBomResultHash: "bom-hash-1",
      input: { title: "Solar proposal" },
      result: { total: 18000 },
    });

    expect(provenance.bomRunId).toBe("bom-1");
    expect(provenance.sourceBomResultHash).toBe("bom-hash-1");
  });

  it("rejects missing provenance identifiers", () => {
    expect(() => buildBomOutputProvenance({
      designVersionId: "",
      financialRunId: "financial-1",
      sourceFinancialResultHash: "hash",
      input: {},
      result: {},
    })).toThrow("designVersionId is required");

    expect(() => buildProposalOutputProvenance({
      designVersionId: "design-v1",
      financialRunId: "financial-1",
      bomRunId: "",
      sourceFinancialResultHash: "hash",
      sourceBomResultHash: "bom-hash",
      input: {},
      result: {},
    })).toThrow("bomRunId is required");
  });
});
