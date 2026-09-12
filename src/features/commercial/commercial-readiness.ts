export type CommercialReadinessStatus = "blocked" | "ready" | "warning";
export interface CommercialReadinessInput { designFinalized: boolean; engineeringAccepted: boolean; simulationCompleted: boolean; financialCompleted: boolean; bomAvailable: boolean; proposalAvailable: boolean; simulationProvenance?: "reference" | "user_supplied" | "site_weather" | null; warnings?: string[]; source?: { projectId?: string; designVersionId: string; financialRunId: string | null; bomRunId: string | null; proposalRunId: string | null }; }
export interface CommercialReadinessStep { id: "design" | "engineering" | "simulation" | "financial" | "bom" | "proposal"; label: string; complete: boolean; }
export interface CommercialReadiness { status: CommercialReadinessStatus; steps: CommercialReadinessStep[]; canGenerateBom: boolean; canGenerateProposal: boolean; provenanceLabel: string; blockers: string[]; warnings: string[]; source: { projectId?: string; designVersionId: string; financialRunId: string | null; bomRunId: string | null; proposalRunId: string | null } | null; }
export function getCommercialReadiness(input: CommercialReadinessInput): CommercialReadiness {
  const blockers: string[] = []; const warnings = [...(input.warnings ?? [])];
  if (!input.designFinalized) blockers.push("Finalize the design before creating commercial outputs.");
  if (!input.engineeringAccepted) blockers.push("Engineering acceptance is required before commercial outputs.");
  if (!input.simulationCompleted) blockers.push("Complete the simulation before generating a BOM or proposal.");
  if (!input.financialCompleted) blockers.push("Complete the financial run before generating a BOM or proposal.");
  if (input.simulationProvenance === "reference") warnings.push("Production uses reference yield data; this is not a bankable site/weather estimate.");
  else if (!input.simulationProvenance) warnings.push("Simulation provenance is not available.");
  const canGenerateBom = blockers.length === 0 && Boolean(input.source?.designVersionId && input.source?.financialRunId);
  const canGenerateProposal = canGenerateBom && input.bomAvailable && Boolean(input.source?.bomRunId);
  const status: CommercialReadinessStatus = blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ready";
  return { status, steps: [
    { id: "design", label: "Design finalized", complete: input.designFinalized },
    { id: "engineering", label: "Engineering accepted", complete: input.engineeringAccepted },
    { id: "simulation", label: "Simulation completed", complete: input.simulationCompleted },
    { id: "financial", label: "Financial run completed", complete: input.financialCompleted },
    { id: "bom", label: "BOM snapshot", complete: input.bomAvailable },
    { id: "proposal", label: "Proposal snapshot", complete: input.proposalAvailable },
  ], canGenerateBom, canGenerateProposal, provenanceLabel: input.simulationProvenance === "site_weather" ? "Site/weather" : input.simulationProvenance === "user_supplied" ? "User supplied" : input.simulationProvenance === "reference" ? "Reference estimate" : "Unknown", blockers, warnings, source: input.source ?? null };
}
