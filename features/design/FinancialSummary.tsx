"use client";

export interface FinancialSummaryMetrics {
  initialNetCostUsd?: unknown;
  firstYearSavingsUsd?: unknown;
  paybackYears?: unknown;
  npvUsd?: unknown;
  warnings?: unknown;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function FinancialSummary({ metrics }: { metrics?: FinancialSummaryMetrics }) {
  const netCost = finiteNumber(metrics?.initialNetCostUsd);
  const firstYearSavings = finiteNumber(metrics?.firstYearSavingsUsd);
  const payback = finiteNumber(metrics?.paybackYears);
  const npv = finiteNumber(metrics?.npvUsd);
  const warnings = Array.isArray(metrics?.warnings) ? metrics?.warnings.filter((value): value is string => typeof value === "string") : [];
  const configured = netCost !== null || firstYearSavings !== null || payback !== null || npv !== null;

  return (
    <section aria-label="financial summary" data-testid="solar-financial-summary">
      <h3>Financial analysis</h3>
      {!configured ? (
        <p data-testid="financial-not-configured">Financial inputs are not configured yet. No financial value is fabricated.</p>
      ) : (
        <>
          <div className="property"><span>Net system cost</span><strong>{netCost === null ? "—" : money(netCost)}</strong></div>
          <div className="property"><span>First-year savings</span><strong>{firstYearSavings === null ? "—" : money(firstYearSavings)}</strong></div>
          <div className="property"><span>Payback</span><strong>{payback === null ? "—" : `${payback.toFixed(1)} years`}</strong></div>
          <div className="property"><span>NPV</span><strong>{npv === null ? "—" : money(npv)}</strong></div>
        </>
      )}
      {warnings.length > 0 && (
        <div role="note" style={{ marginTop: 8, fontSize: 12 }}>
          {warnings.map((warning) => <div key={warning}>{warning}</div>)}
        </div>
      )}
    </section>
  );
}
