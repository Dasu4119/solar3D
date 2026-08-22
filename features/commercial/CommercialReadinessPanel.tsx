"use client";

import type { CommercialReadiness } from "./commercial-readiness";

export function CommercialReadinessPanel({ readiness }: { readiness: CommercialReadiness }) {
  const statusLabel = readiness.status === "ready" ? "Commercially ready" : readiness.status === "warning" ? "Ready with warnings" : "Commercial outputs blocked";

  return (
    <section aria-label="commercial readiness" data-testid="commercial-readiness" data-status={readiness.status}>
      <header>
        <div>
          <span>COMMERCIAL READINESS</span>
          <h3>{statusLabel}</h3>
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

      <footer>
        <button type="button" disabled={!readiness.canGenerateBom}>Generate BOM</button>
        <button type="button" disabled={!readiness.canGenerateProposal}>Generate proposal</button>
      </footer>
    </section>
  );
}
