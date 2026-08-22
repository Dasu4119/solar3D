# Solar3D Release Candidate Gate

## Mandatory gates

- TypeScript typecheck passes.
- Complete unit-test suite passes.
- Production build passes.
- Authenticated commercial E2E passes.
- Design → Engineering → Simulation → Financial → BOM → Proposal lineage is validated.
- Site-weather failure does not silently fall back to reference yield.
- Stale or mismatched downstream lineage is rejected.
- Large-layout performance benchmark passes the agreed threshold.
- Supabase RLS/security review has no unresolved release-blocking findings.

## Policy

A missing authenticated E2E environment is a release blocker. The CI workflow intentionally fails instead of treating missing secrets as a successful test.

This gate is a release-control mechanism, not a substitute for production observability or manual engineering acceptance.
