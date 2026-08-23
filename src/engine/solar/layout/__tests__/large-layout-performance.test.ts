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

const cases = [500, 1000, 2000, 5000] as const;

function generateAtLeast(targetPanels: number) {
  let side = Math.max(30, Math.ceil(Math.sqrt(targetPanels * 1.1 * 1.7)) + 4);
  let candidates = generateLayoutCandidates(
    [{ x: 0, y: 0 }, { x: side, y: 0 }, { x: side, y: side }, { x: 0, y: side }],
    panel,
    { allowedRotations: [0], panelGapM: 0.05, edgeGapM: 0.3 },
  );

  while (candidates.length < targetPanels) {
    side += 2;
    candidates = generateLayoutCandidates(
      [{ x: 0, y: 0 }, { x: side, y: 0 }, { x: side, y: side }, { x: 0, y: side }],
      panel,
      { allowedRotations: [0], panelGapM: 0.05, edgeGapM: 0.3 },
    );
  }

  return candidates;
}

function runBenchmark(targetPanels: number) {
  // The generator is deterministic. Increase the square roof until the actual
  // candidate workload is at least the requested panel count.
  const beforeMemory = process.memoryUsage().heapUsed;
  const start = performance.now();
  const candidates = generateAtLeast(targetPanels);
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
      expect(result.candidateCount).toBeGreaterThanOrEqual(result.targetPanels);
      // Gross-regression guards only. Absolute performance is runner-dependent;
      // the measured values are printed for release review.
      expect(result.elapsedMs).toBeLessThan(30_000);
      expect(result.heapDeltaMb).toBeLessThan(1_024);
    }

    console.table(results);
  }, 120_000);
});
