# Solar3D Release Candidate Checklist

## Gate 1 — Reproducibility

- Pin runtime and development dependency versions.
- Commit and verify the lockfile.
- Ensure CI installs from the lockfile without resolving `latest` ranges.
- Run typecheck, unit tests, production build, and E2E against the same dependency graph.

## Gate 2 — Commercial E2E

Authenticated flow:

`open project -> canonical design context -> edit/Auto Layout -> save -> finalize -> site-weather simulation -> financial -> BOM -> proposal -> reload`

Verify that every downstream result references the expected design version and upstream snapshot/hash.

## Gate 3 — Stale lineage

After generating financial/BOM/proposal outputs, change the design and verify prior outputs are marked stale or rejected and cannot be presented as current.

## Gate 4 — Performance

Run measured scenarios for 20, 100, 500, 1,000, 2,000 and 5,000 panels. Record layout generation time, memory, render responsiveness, save/load time, and simulation request latency. Use CI artifacts as evidence.

## Gate 5 — Security

Verify authenticated access, project/organization isolation, RLS policies, Edge Function authorization, immutable engineering/commercial records, and safe service-role boundaries. Run Supabase advisors against the real production project before launch.

## Gate 6 — Supabase production

Upgrade to Supabase Pro only when the code release gates are green and the production project has been identified. Apply migrations, verify RLS/advisors, run smoke tests, and monitor after deployment.

## Release decision

All six gates must have evidence before calling Solar3D Release Candidate. Feature completeness alone is not release evidence.
