# CI E2E Fixture Recovery Runbook

The authenticated E2E workflow (`.github/workflows/e2e.yml`) depends on a dedicated
Supabase fixture project. On 2026-09-24 the fixture at project ref
`dprsjuqcmfiroilrpvkw` stopped resolving (NXDOMAIN from GitHub runners and
external probes, while `supabase.co` itself resolved). A paused project still
resolves DNS, so this project was deleted or its organization lapsed. The last
green E2E run on `main` was 2026-09-13.

## Option A — restore the original project (preferred, zero repo changes)

1. Sign in to the Supabase dashboard with the account that owned the project.
2. Check **Deleted projects** (or the org's project list) for ref
   `dprsjuqcmfiroilrpvkw`. Supabase allows restoring deleted projects within a
   grace window (typically ~30 days). Restore it.
3. If restored, no repository change is required: the hardcoded
   `E2E_SUPABASE_URL` / `E2E_SUPABASE_ANON_KEY` in `e2e.yml` will work again.
4. Re-run the failed e2e job on the open PR, or push an empty commit to trigger
   a fresh run.

## Option B — create a replacement fixture project

1. Create a new Supabase project (any region; free tier is sufficient).
2. Apply all migrations:

   ```bash
   npx supabase link --project-ref <NEW_PROJECT_REF>
   npx supabase db push
   ```

   The last migration (`20260912153500_add_oidc_e2e_fixture_registry.sql`)
   creates `ci_e2e_fixture_registry` and self-seeds the permanent Org B fixture
   (organization, project, site, design, version, roof, layout and one row per
   commercial run table) required by `ci-e2e-bootstrap`.

3. Deploy all edge functions (the CLI deploys one function per call):

   ```bash
   for fn in ci-e2e-bootstrap ci-e2e-cleanup solar-project-api design-finalization \
             solar-engineering solar-energy-simulation solar-financials \
             commercial-output commercial-readiness; do
     npx supabase functions deploy "$fn" --project-ref <NEW_PROJECT_REF>
   done
   ```

   The deploy and `db push` commands authenticate with `SUPABASE_ACCESS_TOKEN`
   (Account → Access Tokens in the Supabase dashboard). Provide it via the
   environment; never commit it.

4. In the new project set the function secret used for OIDC verification and
   sign-in retries: none beyond the defaults (`SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` are injected by Supabase).
   The bootstrap function verifies GitHub OIDC against
   `REPOSITORY = Dasu4119/solar3D`, `ACTOR_ID = 248278589`, audience
   `solar3d-e2e` — no per-project configuration is needed.
5. Copy the new project URL and **anon (publishable) key**
   (`npx supabase projects api-keys --project-ref <NEW_PROJECT_REF>` or
   dashboard → Settings → API).
6. Provide them as repository secrets `E2E_SUPABASE_URL` /
   `E2E_SUPABASE_ANON_KEY` (preferred — the workflow reads these secrets
   first), or update the fallback values in the `env:` block of
   `.github/workflows/e2e.yml`. Both values are publishable by design; only
   the service-role key and access token are secret.
7. Re-run the e2e workflow.

### Free-tier note

Free-tier Supabase projects pause after ~1 week of inactivity. A paused
project still resolves DNS, so CI fails differently (connection refused at the
bootstrap step, not NXDOMAIN). Restore the fixture from the dashboard when
that happens, or schedule periodic activity for the project.

## Why the workflow reads secrets first

`e2e.yml` uses `${{ secrets.E2E_SUPABASE_URL || 'https://…' }}` fallback
expressions. Setting the two repository secrets is enough to point CI at any
fixture project without touching the workflow file again.

## Post-recovery verification

- `gh pr checks <PR>` shows `e2e` green end to end (bootstrap → Playwright →
  verified cleanup).
- The bootstrap function logs a `stage: complete` entry and the run registry
  row is deleted by `ci-e2e-cleanup` after the suite.
