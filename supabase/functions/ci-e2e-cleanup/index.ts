import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.1.0";

const headers = { "Content-Type": "application/json" };
const ISSUER = "https://token.actions.githubusercontent.com";
const AUDIENCE = "solar3d-e2e";
const REPOSITORY = "Dasu4119/solar3D";
const ACTOR_ID = "248278589";
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks`));
const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function verifyGitHubOidc(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) throw new Error("GitHub OIDC bearer token required");
  const { payload } = await jwtVerify(auth.slice(7), JWKS, { issuer: ISSUER, audience: AUDIENCE });
  if (payload.repository !== REPOSITORY) throw new Error("Unexpected repository claim");
  if (String(payload.actor_id ?? "") !== ACTOR_ID) throw new Error("Unexpected GitHub actor");
  const workflowRef = String(payload.workflow_ref ?? payload.job_workflow_ref ?? "");
  if (!workflowRef.startsWith(`${REPOSITORY}/.github/workflows/e2e.yml@`)) throw new Error("Unexpected workflow claim");
}

async function deleteUser(service: SupabaseClient, userId: string) {
  const { error } = await service.auth.admin.deleteUser(userId);
  if (error && !/not found/i.test(error.message ?? "")) throw new Error(`delete CI user: ${error.message}`);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return out({ error: "POST required" }, 405);
  try {
    await verifyGitHubOidc(req);
    const body = await req.json().catch(() => ({}));
    const fixtureId = String(body.fixture_id ?? "");
    if (!fixtureId) return out({ error: "fixture_id is required" }, 400);

    const service = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: registry, error: registryError } = await service
      .from("ci_e2e_fixture_registry")
      .select("organization_id")
      .eq("id", true)
      .single();
    if (registryError || !registry) throw new Error(`load permanent CI fixture: ${registryError?.message ?? "missing"}`);

    const { data: run, error: runError } = await service
      .from("ci_e2e_runs")
      .select("fixture_id,organization_a_id,user_a_id,user_b_id")
      .eq("fixture_id", fixtureId)
      .maybeSingle();
    if (runError) throw new Error(`load CI run: ${runError.message}`);
    if (!run) return out({ success: true, already_absent: true, fixture_id: fixtureId });

    const membershipDelete = await service
      .from("organization_members")
      .delete()
      .eq("organization_id", registry.organization_id)
      .eq("user_id", run.user_b_id);
    if (membershipDelete.error) throw new Error(`remove Org B CI membership: ${membershipDelete.error.message}`);

    const { data: cleanup, error: cleanupError } = await service.rpc("cleanup_ci_e2e_organization", {
      p_organization_id: run.organization_a_id,
    });
    if (cleanupError) throw new Error(`cleanup CI organization: ${cleanupError.message}`);

    await deleteUser(service, run.user_a_id);
    await deleteUser(service, run.user_b_id);

    const { data: remainingRun, error: verifyRunError } = await service
      .from("ci_e2e_runs")
      .select("fixture_id")
      .eq("fixture_id", fixtureId)
      .maybeSingle();
    if (verifyRunError) throw new Error(`verify CI run cleanup: ${verifyRunError.message}`);
    if (remainingRun) throw new Error(`CI run ${fixtureId} remained after cleanup`);

    const { data: remainingOrg, error: verifyOrgError } = await service
      .from("organizations")
      .select("id")
      .eq("id", run.organization_a_id)
      .maybeSingle();
    if (verifyOrgError) throw new Error(`verify CI organization cleanup: ${verifyOrgError.message}`);
    if (remainingOrg) throw new Error(`CI organization ${run.organization_a_id} remained after cleanup`);

    return out({ success: true, verified_cleanup: true, fixture_id: fixtureId, cleanup });
  } catch (error) {
    console.error(error);
    return out({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
