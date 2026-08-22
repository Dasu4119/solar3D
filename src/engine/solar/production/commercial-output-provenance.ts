export interface CommercialOutputProvenance {
  designVersionId: string;
  financialRunId: string;
  sourceFinancialResultHash: string;
  input: unknown;
  result: unknown;
}

export interface ProposalOutputProvenance extends CommercialOutputProvenance {
  bomRunId: string;
  sourceBomResultHash: string;
}

function requireValue(name: string, value: string) {
  if (!value) throw new Error(`${name} is required`);
}

export function buildBomOutputProvenance(args: {
  designVersionId: string;
  financialRunId: string;
  sourceFinancialResultHash: string;
  input: unknown;
  result: unknown;
}): CommercialOutputProvenance {
  requireValue("designVersionId", args.designVersionId);
  requireValue("financialRunId", args.financialRunId);
  requireValue("sourceFinancialResultHash", args.sourceFinancialResultHash);
  return {
    designVersionId: args.designVersionId,
    financialRunId: args.financialRunId,
    sourceFinancialResultHash: args.sourceFinancialResultHash,
    input: structuredClone(args.input),
    result: structuredClone(args.result),
  };
}

export function buildProposalOutputProvenance(args: {
  designVersionId: string;
  financialRunId: string;
  bomRunId: string;
  sourceFinancialResultHash: string;
  sourceBomResultHash: string;
  input: unknown;
  result: unknown;
}): ProposalOutputProvenance {
  requireValue("designVersionId", args.designVersionId);
  requireValue("financialRunId", args.financialRunId);
  requireValue("bomRunId", args.bomRunId);
  requireValue("sourceFinancialResultHash", args.sourceFinancialResultHash);
  requireValue("sourceBomResultHash", args.sourceBomResultHash);
  return {
    designVersionId: args.designVersionId,
    financialRunId: args.financialRunId,
    bomRunId: args.bomRunId,
    sourceFinancialResultHash: args.sourceFinancialResultHash,
    sourceBomResultHash: args.sourceBomResultHash,
    input: structuredClone(args.input),
    result: structuredClone(args.result),
  };
}
