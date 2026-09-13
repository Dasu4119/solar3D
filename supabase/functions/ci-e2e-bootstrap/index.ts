import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.1.0";

const headers = { "Content-Type": "application/json" };
const ISSUER = "https://token.actions.githubusercontent.com";
const AUDIENCE = "solar3d-e2e";
const REPOSITORY = "Dasu4119/solar3D";
const ACTOR_ID = "248278589";
const CI_ORG_PREFIX = "__solar3d_ci_a_";
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks`));
const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function must(result: any, label: string) {
  if (result?.error || result?.data == null) throw new Error(`${label}: ${result?.error?.message ?? "no data"}`);
  return result.data;
}

function assertNoError(result: { error?: { message?: string } | null }, label: string) {
  if (result.error) throw new Error(`${label}: ${result.error.message ?? "database operation failed"}`);
}

async function verifyGitHubOidc(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) throw new Error("GitHub OIDC bearer token required");
  const { payload } = await jwtVerify(auth.slice(7), JWKS, { issuer: ISSUER, audience: AUDIENCE });
  if (payload.repository !== REPOSITORY) throw new Error(`Unexpected repository claim: ${String(payload.repository ?? "missing")}`);
  if (String(payload.actor_id ?? "") !== ACTOR_ID) throw new Error(`Unexpected GitHub actor id: ${String(payload.actor_id ?? "missing")}`);
  const workflowRef = String(payload.workflow_ref ?? payload.job_workflow_ref ?? "");
  if (!workflowRef.startsWith(`${REPOSITORY}/.github/workflows/e2e.yml@`)) {
    throw new Error(`Unexpected workflow claim: ${workflowRef || "missing"}`);
  }
}

async function findUserByEmail(service: SupabaseClient, email: string) {
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < 200) break;
  }
  return null;
}

async function deleteUserByEmail(service: SupabaseClient, email: string) {
  const user = await findUserByEmail(service, email);
  if (!user) return;
  const { error } = await service.auth.admin.deleteUser(user.id);
  if (error && !/not found/i.test(error.message ?? "")) throw new Error(`delete Auth user ${email}: ${error.message}`);
}

async function deleteUserById(service: SupabaseClient, userId: string) {
  const { error } = await service.auth.admin.deleteUser(userId);
  if (error && !/not found/i.test(error.message ?? "")) throw new Error(`delete Auth user ${userId}: ${error.message}`);
}

async function cleanupOrganizationData(service: SupabaseClient, organizationId: string) {
  const { data: organization, error: organizationError } = await service
    .from("organizations")
    .select("id,name,slug")
    .eq("id", organizationId)
    .maybeSingle();
  if (organizationError) throw new Error(`load CI organization: ${organizationError.message}`);
  if (!organization) return;
  if (!String(organization.slug ?? "").startsWith(CI_ORG_PREFIX) || !String(organization.name ?? "").startsWith("Solar3D CI Org A ")) {
    throw new Error(`Refusing to clean non-CI organization ${organizationId}`);
  }

  const { data: projects, error: projectsError } = await service.from("projects").select("id").eq("organization_id", organizationId);
  if (projectsError) throw new Error(`load CI projects: ${projectsError.message}`);
  const projectIds = (projects ?? []).map((row: any) => row.id);

  let designIds: string[] = [];
  if (projectIds.length) {
    const { data: designs, error } = await service.from("designs").select("id").in("project_id", projectIds);
    if (error) throw new Error(`load CI designs: ${error.message}`);
    designIds = (designs ?? []).map((row: any) => row.id);
  }

  let designVersionIds: string[] = [];
  if (designIds.length) {
    const { data: versions, error } = await service.from("design_versions").select("id").in("design_id", designIds);
    if (error) throw new Error(`load CI design versions: ${error.message}`);
    designVersionIds = (versions ?? []).map((row: any) => row.id);
  }

  if (designVersionIds.length) {
    assertNoError(await service.from("proposal_runs").delete().in("design_version_id", designVersionIds), "delete CI proposal runs");
    assertNoError(await service.from("bom_runs").delete().in("design_version_id", designVersionIds), "delete CI BOM runs");
    assertNoError(await service.from("engineering_results").delete().in("design_version_id", designVersionIds), "delete CI engineering results");
    assertNoError(await service.from("financial_runs").delete().in("design_version_id", designVersionIds), "delete CI financial runs");
    assertNoError(await service.from("simulation_runs").delete().in("design_version_id", designVersionIds), "delete CI simulation runs");
  }

  assertNoError(await service.from("organizations").delete().eq("id", organizationId), "delete CI organization");
  const { data: remaining, error: verifyError } = await service.from("organizations").select("id").eq("id", organizationId).maybeSingle();
  if (verifyError) throw new Error(`verify CI organization cleanup: ${verifyError.message}`);
  if (remaining) throw new Error(`CI organization ${organizationId} remained after cleanup`);
}

async function cleanupRun(service: SupabaseClient, run: any, orgBId: string) {
  if (!run) return;
  assertNoError(
    await service.from("organization_members").delete().eq("organization_id", orgBId).eq("user_id", run.user_b_id),
    "remove Org B CI membership",
  );
  await cleanupOrganizationData(service, run.organization_a_id);
  await deleteUserById(service, run.user_a_id);
  await deleteUserById(service, run.user_b_id);
}

async function cleanupStale(service: SupabaseClient, orgBId: string) {
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: runs, error: runsError } = await service.from("ci_e2e_runs").select("*").lt("created_at", cutoff);
  if (runsError) throw new Error(`load stale CI runs: ${runsError.message}`);
  for (const run of runs ?? []) await cleanupRun(service, run, orgBId);

  // Recover fixtures from older cleanup implementations that deleted the run
  // registry row before verifying that immutable commercial rows were removed.
  const { data: orphanOrganizations, error: orphanError } = await service
    .from("organizations")
    .select("id,slug,created_at")
    .like("slug", `${CI_ORG_PREFIX}%`)
    .lt("created_at", cutoff);
  if (orphanError) throw new Error(`load orphan CI organizations: ${orphanError.message}`);

  for (const organization of orphanOrganizations ?? []) {
    const slug = String(organization.slug ?? "");
    const compactFixtureId = slug.startsWith(CI_ORG_PREFIX) && slug.endsWith("__")
      ? slug.slice(CI_ORG_PREFIX.length, -2)
      : "";
    const userA = compactFixtureId ? await findUserByEmail(service, `solar3d-ci-a-${compactFixtureId}@example.com`) : null;
    const userB = compactFixtureId ? await findUserByEmail(service, `solar3d-ci-b-${compactFixtureId}@example.com`) : null;
    if (userB) {
      assertNoError(
        await service.from("organization_members").delete().eq("organization_id", orgBId).eq("user_id", userB.id),
        "remove orphan Org B CI membership",
      );
    }
    await cleanupOrganizationData(service, organization.id);
    if (userA) await deleteUserById(service, userA.id);
    if (userB) await deleteUserById(service, userB.id);
  }
}

async function makeUser(service: SupabaseClient, label: "a" | "b", fixtureId: string) {
  const compact = fixtureId.replaceAll("-", "");
  const email = `solar3d-ci-${label}-${compact}@example.com`;
  const password = `Ci!${crypto.randomUUID()}9aA`;
  let lastError = "unknown Auth error";

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const existing = await findUserByEmail(service, email).catch(() => null);
    if (existing) {
      const { data, error } = await service.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        app_metadata: { ...(existing.app_metadata ?? {}), ci_fixture_id: fixtureId },
        user_metadata: { ...(existing.user_metadata ?? {}), ci_fixture: true },
      });
      if (!error && data.user) return { id: data.user.id, email, password };
      lastError = error?.message ?? "Unable to normalize recovered CI user";
    } else {
      const { data, error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { ci_fixture_id: fixtureId },
        user_metadata: { ci_fixture: true },
      });
      if (!error && data.user) return { id: data.user.id, email, password };
      lastError = error?.message ?? `create CI user ${label} returned no user`;

      const recovered = await findUserByEmail(service, email).catch(() => null);
      if (recovered) {
        const { data: normalized, error: normalizeError } = await service.auth.admin.updateUserById(recovered.id, {
          password,
          email_confirm: true,
          app_metadata: { ...(recovered.app_metadata ?? {}), ci_fixture_id: fixtureId },
          user_metadata: { ...(recovered.user_metadata ?? {}), ci_fixture: true },
        });
        if (!normalizeError && normalized.user) return { id: normalized.user.id, email, password };
        lastError = normalizeError?.message ?? lastError;
      }
    }

    if (attempt < 4) await sleep(750 * 2 ** (attempt - 1));
  }

  await deleteUserByEmail(service, email);
  throw new Error(`create CI user ${label} failed after retries: ${lastError}`);
}

async function signIn(url: string, anonKey: string, email: string, password: string) {
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let lastError = "no access token";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (!error && data.session?.access_token) return data.session.access_token;
    lastError = error?.message ?? "no access token";
    if (attempt < 3) await sleep(500 * 2 ** (attempt - 1));
  }
  throw new Error(`CI sign-in failed after retries: ${lastError}`);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return out({ error: "POST required" }, 405);

  let stage = "initialize";
  let service: SupabaseClient | null = null;
  let registry: any = null;

  try {
    const url = env("SUPABASE_URL");
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = env("SUPABASE_ANON_KEY");
    service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    stage = "verify_github_oidc";
    await verifyGitHubOidc(req);
    stage = "parse_request";
    const body = await req.json().catch(() => ({}));
    stage = "load_registry";
    registry = must(await service.from("ci_e2e_fixture_registry").select("*").eq("id", true).single(), "load permanent CI fixture");

    if (body.action === "cleanup") {
      stage = "cleanup_fixture";
      const fixtureId = String(body.fixture_id ?? "");
      if (!fixtureId) return out({ error: "fixture_id is required" }, 400);
      const { data: run, error: runError } = await service.from("ci_e2e_runs").select("*").eq("fixture_id", fixtureId).maybeSingle();
      if (runError) throw new Error(`load CI run for cleanup: ${runError.message}`);
      await cleanupRun(service, run, registry.organization_id);
      return out({ success: true, verified_cleanup: true });
    }

    if (body.action !== "bootstrap") return out({ error: "Unknown action" }, 400);
    stage = "cleanup_stale";
    await cleanupStale(service, registry.organization_id);

    const fixtureId = crypto.randomUUID();
    const emailA = `solar3d-ci-a-${fixtureId.replaceAll("-", "")}@example.com`;
    const emailB = `solar3d-ci-b-${fixtureId.replaceAll("-", "")}@example.com`;
    let userA: any = null;
    let userB: any = null;
    let orgAId: string | null = null;

    try {
      stage = "create_user_a";
      userA = await makeUser(service, "a", fixtureId);
      stage = "create_user_b";
      userB = await makeUser(service, "b", fixtureId);
      stage = "create_org_a";
      const orgA = must(await service.from("organizations").insert({
        name: `Solar3D CI Org A ${fixtureId}`,
        slug: `__solar3d_ci_a_${fixtureId.replaceAll("-", "")}__`,
      }).select().single(), "create Org A");
      orgAId = orgA.id;
      stage = "create_memberships";
      must(await service.from("organization_members").insert({ organization_id: orgA.id, user_id: userA.id, role: "owner" }).select().single(), "add Org A owner");
      must(await service.from("organization_members").insert({ organization_id: registry.organization_id, user_id: userB.id, role: "owner" }).select().single(), "add Org B owner");
      stage = "create_project_a";
      const projectA = must(await service.from("projects").insert({ organization_id: orgA.id, name: `Solar3D CI Project A ${fixtureId}`, status: "draft", country: "India", notes: "Ephemeral GitHub OIDC release-gate fixture" }).select().single(), "create Project A");
      stage = "create_site_a";
      const siteA = must(await service.from("sites").insert({ project_id: projectA.id, name: "CI Org A Site", latitude: 16.3067, longitude: 80.4365 }).select().single(), "create Site A");
      stage = "create_design_a";
      const designA = must(await service.from("designs").insert({ project_id: projectA.id, site_id: siteA.id, name: "CI Org A Design", status: "draft" }).select().single(), "create Design A");
      stage = "create_version_a";
      const versionA = must(await service.from("design_versions").insert({ design_id: designA.id, version_number: 1, name: "CI Org A v1", change_summary: "Ephemeral browser persistence fixture", geometry: {}, metrics: {}, created_by: userA.id, status: "draft" }).select().single(), "create Design Version A");
      stage = "create_roof_a";
      const roofA = must(await service.from("roofs").insert({ design_id: designA.id, name: "CI Org A Roof", geometry: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }, { x: 0, y: 6 }], area_m2: 60, elevation_m: 0, pitch_degrees: 0, azimuth_degrees: 180, roof_type: "flat" }).select().single(), "create Roof A");
      stage = "create_layout_a";
      const layoutA = must(await service.from("panel_layouts").insert({ design_version_id: versionA.id, roof_id: roofA.id, module_id: null, panel_count: 0, dc_capacity_kw: 0, setback_m: 0.3 }).select().single(), "create Layout A");
      stage = "activate_design_a";
      must(await service.from("design_versions").update({ active_layout_id: layoutA.id }).eq("id", versionA.id).select().single(), "activate Layout A");
      must(await service.from("designs").update({ active_version_id: versionA.id, draft_version_id: versionA.id }).eq("id", designA.id).select().single(), "activate Version A");
      stage = "register_run";
      must(await service.from("ci_e2e_runs").insert({ fixture_id: fixtureId, organization_a_id: orgA.id, user_a_id: userA.id, user_b_id: userB.id }).select().single(), "register CI run");
      stage = "sign_in_users";
      const [tokenA, tokenB] = await Promise.all([signIn(url, anonKey, userA.email, userA.password), signIn(url, anonKey, userB.email, userB.password)]);
      stage = "complete";
      return out({ success: true, fixture_id: fixtureId, org_a: { user_id: userA.id, email: userA.email, password: userA.password, access_token: tokenA, project_id: projectA.id }, org_b: { user_id: userB.id, email: userB.email, password: userB.password, access_token: tokenB, project_id: registry.project_id }, org_b_resource_ids: { projects: registry.project_id, sites: registry.site_id, designs: registry.design_id, roofs: registry.roof_id, panel_layouts: registry.panel_layout_id, simulation_runs: registry.simulation_run_id, financial_runs: registry.financial_run_id, bom_runs: registry.bom_run_id, proposal_runs: registry.proposal_run_id } });
    } catch (error) {
      if (userB) {
        assertNoError(
          await service.from("organization_members").delete().eq("organization_id", registry.organization_id).eq("user_id", userB.id),
          "remove partial Org B CI membership",
        );
      }
      if (orgAId) await cleanupOrganizationData(service, orgAId);
      if (userA) await deleteUserById(service, userA.id);
      else await deleteUserByEmail(service, emailA);
      if (userB) await deleteUserById(service, userB.id);
      else await deleteUserByEmail(service, emailB);
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(stage, message);
    if (service) await service.from("ci_e2e_diagnostics").insert({ stage, message: message.slice(0, 1000) }).catch(() => undefined);
    return out({ error: message, stage }, stage === "verify_github_oidc" ? 403 : 500);
  }
});
