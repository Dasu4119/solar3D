import { describe, expect, it } from "vitest";
import { createProductionHeatmapScale, normalizeProduction, productionHeatmapColor, productionHeatmapLegend } from "./production-heatmap";

describe("production heatmap", () => {
  it("creates a finite min/max scale", () => {
    expect(createProductionHeatmapScale([10, Number.NaN, 30, Infinity])).toEqual({ min: 10, max: 30 });
  });

  it("normalizes and clamps production deterministically", () => {
    const scale = createProductionHeatmapScale([100, 200]);
    expect(normalizeProduction(100, scale)).toBe(0);
    expect(normalizeProduction(150, scale)).toBe(0.5);
    expect(normalizeProduction(300, scale)).toBe(1);
    expect(normalizeProduction(-50, scale)).toBe(0);
  });

  it("handles degenerate scales safely", () => {
    expect(normalizeProduction(100, { min: 100, max: 100 })).toBe(0);
    expect(normalizeProduction(Number.NaN, { min: 0, max: 100 })).toBe(0);
  });

  it("uses stable production bands", () => {
    const scale = { min: 0, max: 100 };
    expect(productionHeatmapColor(0, scale)).toBe("#dc2626");
    expect(productionHeatmapColor(50, scale)).toBe("#eab308");
    expect(productionHeatmapColor(100, scale)).toBe("#16a34a");
  });

  it("exposes a stable three-level legend", () => {
    expect(productionHeatmapLegend()).toEqual([
      { label: "low", value: 0 },
      { label: "medium", value: 0.5 },
      { label: "high", value: 1 },
    ]);
  });
});
