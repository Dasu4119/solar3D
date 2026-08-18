export interface ProductionHeatmapScale {
  min: number;
  max: number;
}

export interface ProductionHeatmapColor {
  label: "low" | "medium" | "high";
  value: number;
}

export function createProductionHeatmapScale(values: number[]): ProductionHeatmapScale {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...finite), max: Math.max(...finite) };
}

export function normalizeProduction(value: number, scale: ProductionHeatmapScale): number {
  if (!Number.isFinite(value) || scale.max <= scale.min) return 0;
  return Math.max(0, Math.min(1, (value - scale.min) / (scale.max - scale.min)));
}

/** Returns a deterministic SVG-friendly color along a blue -> amber -> red production scale. */
export function productionHeatmapColor(value: number, scale: ProductionHeatmapScale): string {
  const normalized = normalizeProduction(value, scale);
  if (normalized >= 0.66) return "#16a34a";
  if (normalized >= 0.33) return "#eab308";
  return "#dc2626";
}

export function productionHeatmapLegend(): ProductionHeatmapColor[] {
  return [
    { label: "low", value: 0 },
    { label: "medium", value: 0.5 },
    { label: "high", value: 1 },
  ];
}
