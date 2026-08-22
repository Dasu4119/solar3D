"use client";

import { useState } from "react";
import { invokeFunction } from "@/shared/api/client";
import { getCommercialReadiness, type CommercialReadiness } from "./commercial-readiness";

interface ReadinessResponse {
  success?: boolean;
  error?: string;
  readiness?: {
    designFinalized: boolean;
    engineeringAccepted: boolean;
    simulationCompleted: boolean;
    financialCompleted: boolean;
    bomAvailable: boolean;
    proposalAvailable: boolean;
    simulationProvenance?: "reference" | "user_supplied" | "site_weather" | null;
    warnings?: string[];
    source?: {
      projectId?: string;
      designVersionId: string;
      financialRunId: string | null;
      bomRunId: string | null;
      proposalRunId: string | null;
    };
  };
}

interface CommercialReadinessPanelProps {
  readiness: CommercialReadiness;
}

export function CommercialReadinessPanel({ readiness: initialReadiness }: CommercialReadinessPanelProps) {
  const [readiness, setReadiness] = useState(initialReadiness);
  const [busy, setBusy] = useState<"bom" | "proposal" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh(projectId: string) {
    const response = await invokeFunction<ReadinessResponse>("commercial-readiness", { project_id: projectId });
    if (!response.success || !response.readiness) throw new Error(response.error ?? "Commercial readiness is unavailable");
    setReadiness(getCommercialReadiness(response.readiness));
  }

  async function generateBom() {
    const source = readiness.source;
    if (!source?.projectId || !source.designVersionId || !source.financialRunId) return;
    try {
      setBusy("bom");
      setMessage(null);
      const response = await invokeFunction<{ success?: boolean; error?: string }>("commercial-output", {
        action: "generate_bom",
        design_version_id: source.designVersionId,
        financial_run_id: source.financialRunId,
      });
      if (!response.success) throw new Error(response.error ?? "Unable to generate BOM");
      await refresh(source.projectId);
      setMessage("BOM snapshot generated successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to generate BOM");
    } finally {
      setBusy(null);
    }
  }

  async function generateProposal() {
    const source = readiness.source;
    if (!source?.projectId || !source.designVersionId || !source.financialRunId || !source.bomRunId) return;
    try {
      setBusy("proposal");
      setMessage(null);
      const response = await invokeFunction<{ success?: boolean; error?: string }>("commercial-output", {
        action: "generate_proposal",
        design_version_id: source.designVersionId,
        financial_run_id: source.financialRunId,
        bom_run_id: source.bomRunId,
      });
      if (!response.success) throw new Error(response.error ?? "Unable to generate proposal");
      await refresh(source.projectId);
      setMessage("Proposal snapshot generated successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to generate proposal");
    } finally {
      setBusy(null);
    }
  }

  const statusLabel = readiness.status === "ready" ? "Commercially ready" : readiness.status === "warning" ? "Ready with warnings" : "Commercial outputs blocked";
  const bomEnabled = readiness.canGenerateBom && Boolean(readiness.source?.financialRunId) && busy === null;
  const proposalEnabled = readiness.canGenerateProposal && Boolean(readiness.source?.bomRunId) && busy === null;

  return (
    <section aria-labelledby="commercial-readiness-title" data-testid="commercial-readiness" data-status={readiness.status}>
      <header>
        <div>
          <span>COMMERCIAL READINESS</span>
          <h3 id="commercial-readiness-title">{statusLabel}</h3>
        </div>
        <strong>{readiness.provenanceLabel}</strong>
      </header>
      <ol aria-label="commercial lineage">
        {readiness.steps.map((step) => (
          <li key={step.id} data-complete={step.complete}>
            <span aria-hidden="true">{step.complete ? "✓" : "○"}</span>
            <span>{step.label}</span>
          </li>
        ))}
      </ol>
      {readiness.blockers.length > 0 && (
        <div role="alert"><strong>Action required</strong>{readiness.blockers.map((blocker) => <p key={blocker}>{blocker}</p>)}</div>
      )}
      {readiness.warnings.length > 0 && (
        <div role="note">{readiness.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>
      )}
      <footer>
        <button type="button" disabled={!bomEnabled} onClick={() => void generateBom()}>{busy === "bom" ? "Generating…" : readiness.steps.find((step) => step.id === "bom")?.complete ? "Regenerate BOM" : "Generate BOM"}</button>
        <button type="button" disabled={!proposalEnabled} onClick={() => void generateProposal()}>{busy === "proposal" ? "Generating…" : readiness.steps.find((step) => step.id === "proposal")?.complete ? "Regenerate proposal" : "Generate proposal"}</button>
      </footer>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
