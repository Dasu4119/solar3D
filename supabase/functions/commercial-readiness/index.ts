import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const out = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: cors });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_ANON_KEY");
    const auth = req.headers.get("Authorization");
    if (!url || !key) return out({ error: "Supabase environment is not configured" }, 500);
    if (!auth) return out({ error: "Authorization header required" }, 401);

    const db = createClient(url, key, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: userError } = await db.auth.getUser();
    if (userError || !user) return out({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const projectId = body.project_id ?? body.projectId;
    if (!projectId) return out({ error: "project_id is required" }, 400);

    const { data: project, error: projectError } = await db.from("projects").select("id,organization_id").eq("id", projectId).single();
    if (projectError || !project) return out({ error: "Project not found or access denied" }, 404);
    const { data: member } = await db.from("organization_members").select("role").eq("organization_id", project.organization_id).eq("user_id", user.id).maybeSingle();
    if (!member) return out({ error: "Project not found or access denied" }, 404);

    const { data: design, error: designError } = await db.from("designs").select("id,active_version_id,draft_version_id").eq("project_id", projectId).order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (designError) throw designError;
    if (!design?.active_version_id) {
      return out({ success: true, readiness: { designFinalized: false, engineeringAccepted: false, simulationCompleted: false, financialCompleted: false, bomAvailable: false, proposalAvailable: false, simulationProvenance: null, warnings: [] } });
    }

    const { data: version, error: versionError } = await db.from("design_versions").select("id,status,acceptance_status,content_hash").eq("id", design.active_version_id).single();
    if (versionError) throw versionError;

    const { data: simulation, error: simulationError } = await db.from("simulation_runs").select("id,status,design_version_id,provenance_class,design_content_hash,result_hash,created_at").eq("design_version_id", version.id).eq("status", "completed").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (simulationError) throw simulationError;

    const { data: financial, error: financialError } = await db.from("financial_runs").select("id,status,design_version_id,simulation_run_id,source_simulation_result_hash,result_hash,created_at").eq("design_version_id", version.id).eq("status", "completed").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (financialError) throw financialError;

    const financialMatchesSimulation = Boolean(financial && simulation && financial.simulation_run_id === simulation.id && financial.source_simulation_result_hash === simulation.result_hash);
    const { data: bom, error: bomError } = await db.from("bom_runs").select("id,status,design_version_id,financial_run_id,source_financial_result_hash,result_hash,created_at").eq("design_version_id", version.id).eq("status", "completed").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (bomError) throw bomError;

    const bomMatchesFinancial = Boolean(bom && financial && bom.financial_run_id === financial.id && bom.source_financial_result_hash === financial.result_hash);
    const { data: proposal, error: proposalError } = await db.from("proposal_runs").select("id,status,design_version_id,bom_run_id,financial_run_id,source_bom_result_hash,source_financial_result_hash,result_hash,created_at").eq("design_version_id", version.id).eq("status", "completed").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (proposalError) throw proposalError;

    const proposalMatchesLineage = Boolean(proposal && bom && financial && proposal.bom_run_id === bom.id && proposal.financial_run_id === financial.id && proposal.source_bom_result_hash === bom.result_hash && proposal.source_financial_result_hash === financial.result_hash);
    const simulationProvenance = simulation?.design_content_hash && simulation.design_content_hash === version.content_hash ? simulation.provenance_class : null;

    return out({
      success: true,
      readiness: {
        designFinalized: version.status === "finalized",
        engineeringAccepted: version.acceptance_status === "valid",
        simulationCompleted: Boolean(simulation && simulation.design_content_hash === version.content_hash && simulation.result_hash),
        financialCompleted: financialMatchesSimulation && Boolean(financial?.result_hash),
        bomAvailable: bomMatchesFinancial && Boolean(bom?.result_hash),
        proposalAvailable: proposalMatchesLineage && Boolean(proposal?.result_hash),
        simulationProvenance,
        warnings: simulationProvenance === "reference" ? ["Production uses reference yield data; this is not a bankable site/weather estimate."] : [],
        source: { designVersionId: version.id, simulationRunId: simulation?.id ?? null, financialRunId: financial?.id ?? null, bomRunId: bom?.id ?? null, proposalRunId: proposal?.id ?? null },
      },
    });
  } catch (error) {
    return out({ error: error instanceof Error ? error.message : "Unable to calculate commercial readiness" }, 500);
  }
});
