"use client";

export interface ProductionDashboardMetrics {
  panelCount: number;
  dcCapacityKw: number;
  roofAreaM2: number;
  usableRoofAreaM2: number;
  annualKwh?: number;
  shadingLossPct?: number;
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="production-metric">
      <span className="production-metric-label">{label}</span>
      <strong className="production-metric-value">{value}</strong>
      {detail && <span className="production-metric-detail">{detail}</span>}
    </div>
  );
}

export function ProductionDashboard({ metrics }: { metrics: ProductionDashboardMetrics }) {
  const utilization = metrics.roofAreaM2 > 0
    ? Math.max(0, Math.min(100, (metrics.usableRoofAreaM2 / metrics.roofAreaM2) * 100))
    : 0;

  return (
    <section className="production-dashboard" aria-label="Solar production summary">
      <header className="production-dashboard-header">
        <div>
          <span className="toolbar-title">PRODUCTION</span>
          <h3>System performance</h3>
        </div>
        <span className="production-dashboard-status">Simulation</span>
      </header>
      <div className="production-dashboard-grid">
        <Metric label="Panels" value={String(metrics.panelCount)} />
        <Metric label="DC capacity" value={`${metrics.dcCapacityKw.toFixed(1)} kWp`} />
        <Metric label="Annual energy" value={metrics.annualKwh == null ? "—" : `${Math.round(metrics.annualKwh).toLocaleString()} kWh`} detail={metrics.annualKwh == null ? "Run annual simulation" : "Estimated annual production"} />
        <Metric label="Shading loss" value={metrics.shadingLossPct == null ? "—" : `${metrics.shadingLossPct.toFixed(1)}%`} detail={metrics.shadingLossPct == null ? "No simulation result" : "Annual energy loss"} />
        <Metric label="Roof utilization" value={`${utilization.toFixed(0)}%`} detail={`${metrics.usableRoofAreaM2.toFixed(1)} / ${metrics.roofAreaM2.toFixed(1)} m² usable`} />
      </div>
    </section>
  );
}
