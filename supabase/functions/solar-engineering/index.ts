import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const errorBody = (error: unknown) => {
  if (error instanceof Error) return { error: error.message };
  if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;
    return {
      error: String(value.message ?? value.error ?? "Database operation failed"),
      code: value.code ?? null,
      details: value.details ?? null,
      hint: value.hint ?? null,
    };
  }
  return { error: String(error) };
};
const ENGINE_NAME = "solar3d-engineering";
const ENGINE_VERSION = "2026.09.rc.1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_ANON_KEY");
    const authorization = req.headers.get("Authorization");
    if (!url || !key) return json({ error: "Supabase environment is not configured" }, 500);
    if (!authorization) return json({ error: "Authorization header required" }, 401);

    const db = createClient(url, key, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: userError } = await db.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const designVersionId = String(body.design_version_id ?? body.designVersionId ?? "");
    if (!designVersionId) return json({ error: "design_version_id is required" }, 400);

    const { data: version, error: versionError } = await db.from("design_versions")
      .select("id,design_id,status,content_hash,electrical_topology_status,electrical_topology_hash")
      .eq("id", designVersionId).maybeSingle();
    if (versionError) throw versionError;
    if (!version) return json({ error: "Design version not found or access denied" }, 404);
    if (version.status !== "finalized" || version.electrical_topology_status !== "valid" || !version.electrical_topology_hash) {
      return json({ error: "Engineering requires the active finalized design version with valid electrical topology" }, 409);
    }

    const { data: design, error: designError } = await db.from("designs").select("id,active_version_id").eq("id", version.design_id).maybeSingle();
    if (designError) throw designError;
    if (!design || design.active_version_id !== version.id) return json({ error: "Engineering requires the active finalized design version" }, 409);

    const { data: simulation, error: simulationError } = await db.from("simulation_runs")
      .select("*")
      .eq("design_version_id", version.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (simulationError) throw simulationError;
    if (!simulation?.id || !simulation.result_hash || simulation.design_content_hash !== version.content_hash) {
      return json({ error: "Engineering requires a completed simulation for the active design content" }, 409);
    }

    const { data: layout, error: layoutError } = await db.from("panel_layouts")
      .select("id,panel_count,dc_capacity_kw,module_id")
      .eq("design_version_id", version.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (layoutError) throw layoutError;
    if (!layout || Number(layout.panel_count ?? 0) < 1 || Number(layout.dc_capacity_kw ?? 0) <= 0) {
      return json({ error: "Engineering requires a populated active panel layout" }, 409);
    }

    const { data: strings, error: stringsError } = await db.from("electrical_strings")
      .select("id,string_number,panel_count,inverter_id,validation_status,warnings,power_kw")
      .eq("design_version_id", version.id)
      .order("string_number", { ascending: true });
    if (stringsError) throw stringsError;
    if (!strings?.length || strings.some((item: any) => item.validation_status !== "valid" || !item.inverter_id)) {
      return json({ error: "Engineering requires validated electrical strings" }, 409);
    }

    const inverterId = strings[0].inverter_id;
    if (strings.some((item: any) => item.inverter_id !== inverterId)) {
      return json({ error: "Mixed inverter topology is not supported by this engineering release" }, 409);
    }
    const { data: inverter, error: inverterError } = await db.from("inverters")
      .select("id,model,rated_power_kw,max_dc_power_kw")
      .eq("id", inverterId)
      .eq("active", true)
      .maybeSingle();
    if (inverterError) throw inverterError;
    if (!inverter) return json({ error: "Engineering inverter is unavailable" }, 409);

    const capacityKw = Number(layout.dc_capacity_kw);
    const annualEnergyKwh = Number(simulation.result_snapshot?.year_1_energy_kwh ?? 0);
    const performanceRatio = Number(simulation.assumptions?.performance_ratio ?? 0.8);
    if (!Number.isFinite(annualEnergyKwh) || annualEnergyKwh <= 0) return json({ error: "Simulation has no positive year-1 energy result" }, 409);

    const dcAcRatio = capacityKw / Number(inverter.rated_power_kw || 1);
    const warnings: string[] = [];
    if (dcAcRatio > 1.5) warnings.push("DC/AC ratio is high; review clipping.");
    if (dcAcRatio < 0.8) warnings.push("DC/AC ratio is low; inverter may be oversized.");

    const { data: existing, error: existingError } = await db.from("engineering_results")
      .select("*")
      .eq("design_version_id", version.id)
      .eq("source_simulation_run_id", simulation.id)
      .eq("engine_name", ENGINE_NAME)
      .eq("engine_version", ENGINE_VERSION)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;

    let engineering = existing;
    if (!engineering) {
      const { data, error } = await db.from("engineering_results").insert({
        design_version_id: version.id,
        source_simulation_run_id: simulation.id,
        engine_name: ENGINE_NAME,
        engine_version: ENGINE_VERSION,
        system_capacity_kw: capacityKw,
        annual_energy_kwh: annualEnergyKwh,
        performance_ratio_percent: performanceRatio * 100,
        dc_ac_ratio: dcAcRatio,
        validation_status: "valid",
        warnings,
        validated_by: user.id,
      }).select("*").single();
      if (error) throw error;
      engineering = data;
    }

    const { data: acceptance, error: acceptanceError } = await db.rpc("validate_design_acceptance_gate", { p_design_version_id: version.id });
    if (acceptanceError) throw acceptanceError;
    if (acceptance?.status !== "valid") return json({ error: "Engineering acceptance gate failed", acceptance, engineering }, 422);

    return json({
      success: true,
      valid: true,
      design_version_id: version.id,
      simulation_run_id: simulation.id,
      engineering_result: engineering,
      acceptance,
      warnings,
      errors: [],
      strings,
      inverter,
      engine: { name: ENGINE_NAME, version: ENGINE_VERSION },
    });
  } catch (error) {
    console.error(error);
    return json(errorBody(error), 500);
  }
});
