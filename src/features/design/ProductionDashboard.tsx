"use client";

export interface ProductionDashboardMetrics {
  panelCount: number;
  dcCapacityKw: number;
  roofAreaM2: number | null;
  usableRoofAreaM2?: number | null;
  annualKwh?: number;
  shadingLossPct?: number;
}

export function calculateRoofUtilization(roofAreaM2: number | null, usableRoofAreaM2: number | null | undefined): number | null {
  if (roofAreaM2 == null || roofAreaM2 <= 0 || usableRoofAreaM2 == null || !Number.isFinite(usableRoofAreaM2)) return null;
  return Math.max(0, Math.min(100, (usableRoofAreaM2 / roofAreaM2) * 100));
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="production-metric"><span className="production-metric-label">{label}</span><strong className="production-metric-value">{value}</strong>{detail && <span className="production-metric-detail">{detail}</span>}</div>;
}

export function ProductionDashboard({ metrics }: { metrics: ProductionDashboardMetrics }) {
  const utilization = calculateRoofUtilization(metrics.roofAreaM2, metrics.usableRoofAreaM2);
  const roofDetail = metrics.roofAreaM2 == null ? "Project roof area unavailable" : metrics.usableRoofAreaM2 == null ? `${metrics.roofAreaM2.toFixed(1)} m² total; usable area not calculated` : `${metrics.usableRoofAreaM2.toFixed(1)} / ${metrics.roofAreaM2.toFixed(1)} m² usable`;
  return (
    <section className="production-dashboard" aria-label="Solar production summary">
      <header className="production-dashboard-header"><div><span className="toolbar-title">PRODUCTION</span><h3>System performance</h3></div><span className="production-dashboard-status">Simulation</span></header>
      <div className="production-dashboard-grid">
        <Metric label="Panels" value={String(metrics.panelCount)} />
        <Metric label="DC capacity" value={`${metrics.dcCapacityKw.toFixed(1)} kWp`} />
        <Metric label="Annual energy" value={metrics.annualKwh == null ? "—" : `${Math.round(metrics.annualKwh).toLocaleString()} kWh`} detail={metrics.annualKwh == null ? "Run annual simulation" : "Estimated annual production"} />
        <Metric label="Shading loss" value={metrics.shadingLossPct == null ? "—" : `${metrics.shadingLossPct.toFixed(1)}%`} detail={metrics.shadingLossPct == null ? "No simulation result" : "Annual energy loss"} />
        <Metric label="Roof utilization" value={utilization == null ? "—" : `${utilization.toFixed(0)}%`} detail={roofDetail} />
      </div>
    </section>
  );
}
