"use client";

import type { CommercialReadiness } from "./commercial-readiness";

interface CommercialReadinessPanelProps {
  readiness: CommercialReadiness;
  onGenerateBom?: () => void;
  onGenerateProposal?: () => void;
}

export function CommercialReadinessPanel({ readiness, onGenerateBom, onGenerateProposal }: CommercialReadinessPanelProps) {
  const statusLabel = readiness.status === "ready" ? "Commercially ready" : readiness.status === "warning" ? "Ready with warnings" : "Commercial outputs blocked";
  const bomEnabled = readiness.canGenerateBom && Boolean(onGenerateBom);
  const proposalEnabled = readiness.canGenerateProposal && Boolean(onGenerateProposal);

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
        <div role="alert">
          <strong>Action required</strong>
          {readiness.blockers.map((blocker) => <p key={blocker}>{blocker}</p>)}
        </div>
      )}
      {readiness.warnings.length > 0 && (
        <div role="note">
          {readiness.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      )}
      {(onGenerateBom || onGenerateProposal) && (
        <footer>
          {onGenerateBom && <button type="button" disabled={!bomEnabled} onClick={onGenerateBom}>Generate BOM</button>}
          {onGenerateProposal && <button type="button" disabled={!proposalEnabled} onClick={onGenerateProposal}>Generate proposal</button>}
        </footer>
      )}
    </section>
  );
}
