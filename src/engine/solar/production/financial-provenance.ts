import type { FinancialOptimizationInput, FinancialOptimizationResult } from "./financial-model";

export interface FinancialRunProvenance {
  simulationRunId: string;
  designVersionId: string;
  sourceSimulationResultHash: string;
  engineName: "solar3d-financial";
  engineVersion: string;
  input: FinancialOptimizationInput;
  result: FinancialOptimizationResult;
}

export function buildFinancialRunProvenance(args: {
  simulationRunId: string;
  designVersionId: string;
  sourceSimulationResultHash: string;
  engineVersion: string;
  input: FinancialOptimizationInput;
  result: FinancialOptimizationResult;
}): FinancialRunProvenance {
  if (!args.simulationRunId) throw new Error("simulationRunId is required");
  if (!args.designVersionId) throw new Error("designVersionId is required");
  if (!args.sourceSimulationResultHash) throw new Error("sourceSimulationResultHash is required");
  if (!args.engineVersion) throw new Error("engineVersion is required");

  return {
    simulationRunId: args.simulationRunId,
    designVersionId: args.designVersionId,
    sourceSimulationResultHash: args.sourceSimulationResultHash,
    engineName: "solar3d-financial",
    engineVersion: args.engineVersion,
    input: structuredClone(args.input),
    result: structuredClone(args.result),
  };
}
