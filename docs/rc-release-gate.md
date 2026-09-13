# Solar3D Release Candidate Gate

Issue: #49

## P0 security

- [ ] Supabase Auth leaked-password protection enabled for production.
- [ ] Authentication recovery/session behavior verified.
- [ ] RLS denies cross-organization access.
- [ ] RLS denies cross-project access.
- [ ] Edge Functions reject unauthenticated/unauthorized requests.
- [ ] Immutable engineering/commercial records cannot be modified through client paths.

## P0 commercial E2E

Authenticated test flow:

`login -> project -> canonical design -> Auto Layout/edit -> save -> finalize -> site-weather simulation -> financial -> BOM -> proposal -> reload`

The test must verify each downstream record references the expected design version and upstream snapshot/hash.

## P0 stale lineage

1. Generate simulation, financial, BOM and proposal.
2. Modify the design and create a new active/finalized version.
3. Verify old downstream outputs are stale/ineligible and cannot be presented as current.
4. Generate replacements and verify they reference the new lineage.

## P0 reproducibility

- [ ] `package.json` uses pinned versions.
- [ ] A real npm lockfile is committed.
- [ ] `npm ci` succeeds from a clean checkout.
- [ ] Typecheck succeeds.
- [ ] Unit tests succeed.
- [ ] Production build succeeds.
- [ ] Playwright E2E succeeds.

## Production approval

Do not label the project Release Candidate until every checkbox has evidence. Supabase Pro upgrade follows green security, E2E and reproducibility gates. After upgrade, apply migrations and run a production smoke test.