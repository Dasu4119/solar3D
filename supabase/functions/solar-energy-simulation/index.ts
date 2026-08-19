import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });

const ENGINE_NAME = "solar3d-production";
const ENGINE_VERSION = "2026.08.p0.1";
const MONTHLY_SHARES = [0.075, 0.073, 0.085, 0.085, 0.09, 0.085, 0.09, 0.09, 0.085, 0.08, 0.075, 0.082];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_ANON_KEY");
    const auth = req.headers.get("Authorization");
    if (!url || !key) return json({ error: "Supabase environment is not configured" }, 500);
    if (!auth) return json({ error: "Authorization header required" }, 401);

    const sb = createClient(url, key, { global: { headers: { Authorization: auth } } });
    const token = auth.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: authError } = await sb.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const designVersionId = body.design_version_id;
    if (!designVersionId) return json({ error: "design_version_id is required" }, 400);

    const annualIrradiance = Number(body.annual_irradiance_kwh_m2 ?? 1700);
    const performanceRatio = Number(body.performance_ratio ?? 0.8);
    const degradation = Number(body.annual_degradation_percent ?? 0.5);
    const years = Math.min(30, Math.max(1, Math.floor(Number(body.years ?? 25))));

    if (!Number.isFinite(annualIrradiance) || annualIrradiance < 0) {
      return json({ error: "annual_irradiance_kwh_m2 must be a non-negative number" }, 400);
    }
    if (!Number.isFinite(performanceRatio) || performanceRatio < 0 || performanceRatio > 1) {
      return json({ error: "performance_ratio must be between 0 and 1" }, 400);
    }
    if (!Number.isFinite(degradation) || degradation < 0 || degradation > 100) {
      return json({ error: "annual_degradation_percent must be between 0 and 100" }, 400);
    }

    const { data: engineering, error: engineeringError } = await sb
      .from("engineering_results")
      .select("system_capacity_kw")
      .eq("design_version_id", designVersionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (engineeringError) throw engineeringError;
    if (!engineering?.system_capacity_kw) {
      return json({ error: "No engineering result exists for this design version" }, 400);
    }

    const capacity = Number(engineering.system_capacity_kw);
    const base = capacity * annualIrradiance * performanceRatio;
    const annual = Array.from({ length: years }, (_, index) => {
      const factor = Math.pow(1 - degradation / 100, index);
      return { year: index + 1, energy_kwh: Number((base * factor).toFixed(0)) };
    });
    const monthly = MONTHLY_SHARES.map((share, index) => ({
      month: index + 1,
      energy_kwh: Number((base * share).toFixed(0)),
    }));
    const lifetime = annual.reduce((sum, item) => sum + item.energy_kwh, 0);

    const assumptions = {
      annual_irradiance_kwh_m2: annualIrradiance,
      performance_ratio: performanceRatio,
      annual_degradation_percent: degradation,
      years,
    };
    const inputSnapshot = {
      design_version_id: designVersionId,
      system_capacity_kw: capacity,
      ...assumptions,
    };
    const resultSnapshot = {
      dc_capacity_kw: capacity,
      year_1_energy_kwh: annual[0].energy_kwh,
      lifetime_energy_kwh: Number(lifetime.toFixed(0)),
      monthly,
      annual,
    };
    const weatherSource = {
      type: "user_supplied_or_reference",
      annual_irradiance_kwh_m2: annualIrradiance,
    };

    const { data: lastRun, error: lastRunError } = await sb
      .from("simulation_runs")
      .select("run_number")
      .eq("design_version_id", designVersionId)
      .order("run_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastRunError) throw lastRunError;

    const runNumber = Number(lastRun?.run_number ?? 0) + 1;
    const { data: run, error: runError } = await sb
      .from("simulation_runs")
      .insert({
        design_version_id: designVersionId,
        run_number: runNumber,
        status: "completed",
        engine_name: ENGINE_NAME,
        engine_version: ENGINE_VERSION,
        input_snapshot: inputSnapshot,
        weather_source: weatherSource,
        assumptions,
        result_snapshot: resultSnapshot,
        created_by: user.id,
        completed_at: new Date().toISOString(),
      })
      .select("id,run_number,engine_name,engine_version,input_hash,result_hash,created_at,completed_at")
      .single();

    if (runError) throw runError;

    return json({
      success: true,
      simulation_run: run,
      design_version_id: designVersionId,
      engine: { name: ENGINE_NAME, version: ENGINE_VERSION },
      assumptions,
      summary: {
        dc_capacity_kw: capacity,
        year_1_energy_kwh: annual[0].energy_kwh,
        lifetime_energy_kwh: Number(lifetime.toFixed(0)),
      },
      monthly,
      annual,
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
