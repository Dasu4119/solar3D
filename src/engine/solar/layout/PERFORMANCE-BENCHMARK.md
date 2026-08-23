# Large-layout performance benchmark

The release gate measures deterministic layout candidate generation at 500, 1,000, 2,000 and 5,000 target-panel workloads.

Run:

`npm run test:unit -- src/engine/solar/layout/__tests__/large-layout-performance.test.ts --reporter=verbose`

The benchmark records candidate count, elapsed milliseconds, and heap delta. The test contains only gross-regression safety limits; the printed measurements are the release evidence to review per CI environment.

A release decision must not infer performance from source inspection alone. Record the actual CI results for each workload before declaring the performance gate green.
