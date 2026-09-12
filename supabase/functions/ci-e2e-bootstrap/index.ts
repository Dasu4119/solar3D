import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.1.0";

const jsonHeaders = { "Content-Type": "application/json" };
const GITHUB_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_AUDIENCE = "solar3d-e2e";
const EXPECTED_REPOSITORY = "Dasu4119/solar3D";
const EXPECTED_ACTOR_ID = "248278589";
const JWKS = createRemoteJWKSet(new URL(`${GITHUB_ISSUER}/.well-known/jwks`));

const out = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function requireGitHubOidc(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) throw new Error("GitHub OIDC bearer token required");
  const { payload } = await jwtVerify(auth.slice(7), JWKS, {
    issuer: GITHUB_ISSUER,
    audience: GITHUB_AUDIENCE,
  });
  if (payload.repository !== EXPECTED_REPOSITORY) throw new Error("Unexpected repository claim");
  if (String(payload.actor_id ?? "") !== EXPECTED_ACTOR_ID) throw new Error("Unexpected GitHub actor");
  const workflowRef = String(payload.workflow_ref ?? payload.job_workflow_ref ?? "");
  if (!workflowRef.startsWith(`${EXPECTED_REPOSITORY}/.github/workflows/e2e.yml@`)) {
    throw new Error("Unexpected workflow claim");
  }
  return payload;
}

function must<T>(result: { data: T | null; error: { message?: string } | null }, label: string): T {
  if (result.error || result.data == null) throw new Error(`${label}: ${result.error?.message ?? "no data"}`);
  return result.data;
}

async function cleanupRun(service: SupabaseClient, run: any, orgBId: string) {
  if (!run) return;
  await service.from("organization_members").delete().eq("organization_id", orgBId).eq("user_id", run.user_b_id);
  await service.from("organizations").delete().eq("id", run.organization_a_id);
  await service.from("ci_e2e_runs").delete().eq("fixture_id", run.fixture_id);
  await service.auth.admin.deleteUser(run.user_a_id).catch(() => undefined);
  await service.auth.admin.deleteUser(run.user_b_id).catch(() => undefined);
}

async function cleanupStaleRuns(service: SupabaseClient, orgBId: string) {
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data } = await service.from("ci_e2e_runs").select("*").lt("created_at", cutoff);
  for (const run of data ?? []) await cleanupRun(service, run, orgBId);
}

async function createTemporaryUser(service: SupabaseClient, label: "a" | "b", fixtureId: string) {
  const compact = fixtureId.replaceAll("-", "");
  const email = `solar3d-ci-${label}-${compact}@example.com`;
  const password = `Ci!${crypto.randomUUID()}-${crypto.randomUUID()}9aA`;
  const created = must(
    await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { ci_fixture_id: fixtureId },
      user_metadata: { ci_fixture: true },
    }),
    `create CI user ${label}`,
  );
  if (!created.user) throw new Error(`create CI user ${label}: no user`);
  return { id: created.user.id, email, password };
}

async function signIn(url: string, anonKey: string, email: string, password: string) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session?.access_token) throw new Error(`CI sign-in failed: ${error?.message ?? "no access token"}`);
  return data.session.access_token;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return out({ error: "POST required" }, 405);
  try {
    await requireGitHubOidc(req);
    const body = await req.json().catch(() => ({}));
    const url = requireEnv("SUPABASE_URL");
    const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = requireEnv("SUPABASE_ANON_KEY");
    const service = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const registry = must(
      await service.from("ci_e2e_fixture_registry").select("*").eq("id", true).single(),
      "load permanent CI fixture",
    ) as any;

    if (body.action === "cleanup") {
      const fixtureId = String(body.fixture_id ?? "");
      if (!fixtureId) return out({ error: "fixture_id is required" }, 400);
      const { data: run } = await service.from("ci_e2e_runs").select("*").eq("fixture_id", fixtureId).maybeSingle();
      await cleanupRun(service, run, registry.organization_id);
      return out({ success: true });
    }

    if (body.action !== "bootstrap") return out({ error: "Unknown action" }, 400);

    await cleanupStaleRuns(service, registry.organization_id);

    const fixtureId = crypto.randomUUID();
    let userA: Awaited<ReturnType<typeof createTemporaryUser>> | null = null;
    let userB: Awaited<ReturnType<typeof createTemporaryUser>> | null = null;
    let orgAId: string | null = null;

    try {
      userA = await createTemporaryUser(service, "a", fixtureId);
      userB = await createTemporaryUser(service, "b", fixtureId);

      const orgA = must(
        await service.from("organizations").insert({
          name: `Solar3D CI Org A ${fixtureId}`,
          slug: `__solar3d_ci_a_${fixtureId.replaceAll("-", "")}__`,
        }).select().single(),
        "create Org A",
      ) as any;
      orgAId = orgA.id;

      must(await service.from("organization_members").insert({ organization_id: orgA.id, user_id: userA.id, role: "owner" }).select().single(), "add Org A owner");
      must(await service.from("organization_members").insert({ organization_id: registry.organization_id, user_id: userB.id, role: "owner" }).select().single(), "add Org B owner");

      const projectA = must(await service.from("projects").insert({
        organization_id: orgA.id,
        name: `Solar3D CI Project A ${fixtureId}`,
        status: "draft",
        country: "India",
        notes: "Ephemeral GitHub OIDC release-gate fixture",
      }).select().single(), "create Project A") as any;

      const siteA = must(await service.from("sites").insert({
        project_id: projectA.id,
        name: "CI Org A Site",
        latitude: 16.3067,
        longitude: 80.4365,
      }).select().single(), "create Site A") as any;

      const designA = must(await service.from("designs").insert({
        project_id: projectA.id,
        site_id: siteA.id,
        name: "CI Org A Design",
        status: "draft",
      }).select().single(), "create Design A") as any;

      const versionA = must(await service.from("design_versions").insert({
        design_id: designA.id,
        version_number: 1,
        name: "CI Org A v1",
        change_summary: "Ephemeral browser persistence fixture",
        geometry: {},
        metrics: {},
        created_by: userA.id,
        status: "draft",
      }).select().single(), "create Design Version A") as any;

      const roofA = must(await service.from("roofs").insert({
        design_id: designA.id,
        name: "CI Org A Roof",
        geometry: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }, { x: 0, y: 6 }],
        area_m2: 60,
        elevation_m: 0,
        pitch_degrees: 0,
        azimuth_degrees: 180,
        roof_type: "flat",
      }).select().single(), "create Roof A") as any;

      const layoutA = must(await service.from("panel_layouts").insert({
        design_version_id: versionA.id,
        roof_id: roofA.id,
        module_id: null,
        panel_count: 0,
        dc_capacity_kw: 0,
        setback_m: 0.3,
      }).select().single(), "create Layout A") as any;

      must(await service.from("design_versions").update({ active_layout_id: layoutA.id }).eq("id", versionA.id).select().single(), "activate Layout A");
      must(await service.from("designs").update({ active_version_id: versionA.id, draft_version_id: versionA.id }).eq("id", designA.id).select().single(), "activate Version A");

      must(await service.from("ci_e2e_runs").insert({
        fixture_id: fixtureId,
        organization_a_id: orgA.id,
        user_a_id: userA.id,
        user_b_id: userB.id,
      }).select().single(), "register CI run");

      const [tokenA, tokenB] = await Promise.all([
        signIn(url, anonKey, userA.email, userA.password),
        signIn(url, anonKey, userB.email, userB.password),
      ]);

      return out({
        success: true,
        fixture_id: fixtureId,
        org_a: { user_id: userA.id, email: userA.email, password: userA.password, access_token: tokenA, project_id: projectA.id },
        org_b: { user_id: userB.id, email: userB.email, password: userB.password, access_token: tokenB, project_id: registry.project_id },
        org_b_resource_ids: {
          projects: registry.project_id,
          sites: registry.site_id,
          designs: registry.design_id,
          roofs: registry.roof_id,
          panel_layouts: registry.panel_layout_id,
          simulation_runs: registry.simulation_run_id,
          financial_runs: registry.financial_run_id,
          bom_runs: registry.bom_run_id,
          proposal_runs: registry.proposal_run_id,
        },
      });
    } catch (error) {
      if (orgAId) await service.from("organizations").delete().eq("id", orgAId);
      if (userB) await service.from("organization_members").delete().eq("organization_id", registry.organization_id).eq("user_id", userB.id);
      if (userA) await service.auth.admin.deleteUser(userA.id).catch(() => undefined);
      if (userB) await service.auth.admin.deleteUser(userB.id).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    const authError = /OIDC|repository|actor|workflow|bearer|JWT|token/i.test(message);
    return out({ error: message }, authError ? 403 : 500);
  }
});
