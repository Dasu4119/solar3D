import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });

async function authClient(req: Request) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = req.headers.get("Authorization");
  if (!url || !key) throw new Error("Supabase environment is not configured");
  if (!authorization) throw new Error("Authorization header required");
  const db = createClient(url, key, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return { db, user };
}

async function requireDesignAccess(db: any, userId: string, designVersionId: string) {
  const { data: version, error: ve } = await db.from("design_versions").select("id,design_id,status,version_number").eq("id", designVersionId).single();
  if (ve || !version) throw new Error("Design version not found");
  const { data: design, error: de } = await db.from("designs").select("id,project_id,active_version_id").eq("id", version.design_id).single();
  if (de || !design) throw new Error("Design not found");
  if (design.active_version_id !== designVersionId || version.status !== "finalized") {
    throw new Error("Commercial outputs require the active finalized design version");
  }
  const { data: project, error: pe } = await db.from("projects").select("id,organization_id,name").eq("id", design.project_id).single();
  if (pe || !project) throw new Error("Project not found");
  const { data: member, error: me } = await db.from("organization_members").select("role").eq("organization_id", project.organization_id).eq("user_id", userId).maybeSingle();
  if (me || !member) throw new Error("Access denied");
  return { version, design, project };
}

async function nextRunNumber(db: any, table: string, column: string, id: string) {
  const { data, error } = await db.from(table).select("run_number").eq(column, id).order("run_number", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return Number(data?.run_number ?? 0) + 1;
}

async function loadFinancial(db: any, financialRunId: string, designVersionId: string) {
  const { data: financial, error } = await db.from("financial_runs").select("*").eq("id", financialRunId).single();
  if (error || !financial) throw new Error("Financial run not found");
  if (financial.status !== "completed" || financial.design_version_id !== designVersionId) throw new Error("Financial run is not a completed result for the active design");
  return financial;
}

async function buildBom(db: any, designVersionId: string) {
  const { data: layouts, error: le } = await db.from("panel_layouts").select("id,module_id,roof_id,panel_count,dc_capacity_kw").eq("design_version_id", designVersionId).order("created_at", { ascending: true });
  if (le) throw le;
  if (!layouts?.length) throw new Error("No panel layout exists for the active design");

  const moduleIds = [...new Set(layouts.map((l: any) => l.module_id).filter(Boolean))];
  if (!moduleIds.length) throw new Error("Active layout has no module identity");
  const { data: modules, error: me } = await db.from("solar_modules").select("id,manufacturer,model,power_w,length_m,width_m").in("id", moduleIds).eq("active", true);
  if (me) throw me;
  const byModule = new Map((modules ?? []).map((m: any) => [m.id, m]));
  const items = layouts.map((layout: any) => {
    const module = byModule.get(layout.module_id);
    if (!module) throw new Error(`Module ${layout.module_id} is unavailable`);
    return {
      category: "module",
      sku: module.id,
      manufacturer: module.manufacturer,
      model: module.model,
      quantity: Number(layout.panel_count ?? 0),
      unitPowerWatts: Number(module.power_w),
      roofId: layout.roof_id,
      layoutId: layout.id,
    };
  }).filter((item: any) => item.quantity > 0);

  const totalModules = items.reduce((sum: number, item: any) => sum + item.quantity, 0);
  const dcCapacityKw = layouts.reduce((sum: number, layout: any) => sum + Number(layout.dc_capacity_kw ?? 0), 0);
  return { engine: "solar3d-bom", items, totals: { moduleCount: totalModules, dcCapacityKw }, source: { designVersionId } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { db, user } = await authClient(req);
    const body = await req.json();
    const action = body.action;

    if (action === "generate_bom") {
      if (!body.design_version_id || !body.financial_run_id) return out({ error: "design_version_id and financial_run_id are required" }, 400);
      const { version } = await requireDesignAccess(db, user.id, body.design_version_id);
      const financial = await loadFinancial(db, body.financial_run_id, version.id);
      const result = await buildBom(db, version.id);
      const runNumber = await nextRunNumber(db, "bom_runs", "financial_run_id", financial.id);
      const input = { designVersionId: version.id, financialRunId: financial.id, sourceFinancialResultHash: financial.result_hash };
      const { data: bom, error } = await db.from("bom_runs").insert({
        financial_run_id: financial.id,
        design_version_id: version.id,
        run_number: runNumber,
        status: "completed",
        engine_name: "solar3d-bom",
        engine_version: "2026.08.p1.3",
        input_snapshot: input,
        result_snapshot: result,
        source_financial_result_hash: financial.result_hash,
        created_by: user.id,
        completed_at: new Date().toISOString(),
      }).select("*").single();
      if (error) throw error;
      return out({ success: true, bom });
    }

    if (action === "generate_proposal") {
      if (!body.design_version_id || !body.financial_run_id || !body.bom_run_id) return out({ error: "design_version_id, financial_run_id and bom_run_id are required" }, 400);
      const { version, project } = await requireDesignAccess(db, user.id, body.design_version_id);
      const financial = await loadFinancial(db, body.financial_run_id, version.id);
      const { data: bom, error: be } = await db.from("bom_runs").select("*").eq("id", body.bom_run_id).single();
      if (be || !bom) throw new Error("BOM run not found");
      if (bom.status !== "completed" || bom.design_version_id !== version.id || bom.financial_run_id !== financial.id) throw new Error("BOM lineage does not match the active design and financial run");

      const proposalInput = {
        projectId: project.id,
        projectName: project.name,
        designVersionId: version.id,
        financialRunId: financial.id,
        bomRunId: bom.id,
        sourceFinancialResultHash: financial.result_hash,
        sourceBomResultHash: bom.result_hash,
      };
      const proposalResult = {
        title: `${project.name ?? "Solar3D"} Solar Proposal`,
        designVersion: version.version_number,
        financial: financial.result_snapshot,
        bom: bom.result_snapshot,
        provenance: { weather: financial.input_snapshot?.weather ?? null },
      };
      const runNumber = await nextRunNumber(db, "proposal_runs", "bom_run_id", bom.id);
      const { data: proposal, error } = await db.from("proposal_runs").insert({
        bom_run_id: bom.id,
        financial_run_id: financial.id,
        design_version_id: version.id,
        run_number: runNumber,
        status: "completed",
        engine_name: "solar3d-proposal",
        engine_version: "2026.08.p1.3",
        input_snapshot: proposalInput,
        result_snapshot: proposalResult,
        source_bom_result_hash: bom.result_hash,
        source_financial_result_hash: financial.result_hash,
        created_by: user.id,
        completed_at: new Date().toISOString(),
      }).select("*").single();
      if (error) throw error;
      return out({ success: true, proposal });
    }

    return out({ error: "Unsupported action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Commercial output generation failed";
    const status = message === "Unauthorized" ? 401 : message === "Access denied" ? 403 : 400;
    return out({ error: message }, status);
  }
});
