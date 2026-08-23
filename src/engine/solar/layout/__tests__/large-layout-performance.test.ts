import { describe, expect, it } from "vitest";
import { generateLayoutCandidates } from "@/engine/solar/layout/generator";
import type { SolarPanelSpec } from "@/engine/solar/panel";

const panel: SolarPanelSpec = {
  id: "benchmark-panel",
  manufacturer: "Solar3D Benchmark",
  model: "BENCH-450",
  widthM: 1.1,
  lengthM: 1.7,
  powerWatts: 450,
  efficiency: 0.21,
};

const roof = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

const cases = [500, 1000, 2000, 5000] as const;

function runBenchmark(targetPanels: number) {
  // The generator is a deterministic grid candidate generator. Scale the roof
  // so each benchmark case exercises roughly the requested panel count while
  // preserving the same geometry/constraint characteristics.
  const side = Math.max(30, Math.ceil(Math.sqrt(targetPanels * 1.1 * 1.7)) + 4);
  const benchmarkRoof = [
    { x: 0, y: 0 },
    { x: side, y: 0 },
    { x: side, y: side },
    { x: 0, y: side },
  ];

  const beforeMemory = process.memoryUsage().heapUsed;
  const start = performance.now();
  const candidates = generateLayoutCandidates(benchmarkRoof, panel, {
    allowedRotations: [0],
    panelGapM: 0.05,
    edgeGapM: 0.3,
  });
  const elapsedMs = performance.now() - start;
  const afterMemory = process.memoryUsage().heapUsed;

  return {
    targetPanels,
    candidateCount: candidates.length,
    elapsedMs,
    heapDeltaMb: Math.max(0, afterMemory - beforeMemory) / 1024 / 1024,
  };
}

describe("large-layout performance", () => {
  it("benchmarks 500/1,000/2,000/5,000-panel workloads", () => {
    const results = cases.map(runBenchmark);

    for (const result of results) {
      // The benchmark must exercise a workload at or above the requested scale.
      expect(result.candidateCount).toBeGreaterThanOrEqual(result.targetPanels * 0.9);
      // Gross-regression guard only. CI performance is machine-dependent; the
      // measured values are printed so release review can compare environments.
      expect(result.elapsedMs).toBeLessThan(30_000);
      expect(result.heapDeltaMb).toBeLessThan(1_024);
    }

    console.table(results);
  }, 120_000);
});
