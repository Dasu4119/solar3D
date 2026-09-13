import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const ENGINE_NAME = "solar3d-financial";
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
      .select("id,design_id,status,acceptance_status,content_hash")
      .eq("id", designVersionId)
      .maybeSingle();
    if (versionError) throw versionError;
    if (!version) return json({ error: "Design version not found or access denied" }, 404);
    if (version.status !== "finalized" || version.acceptance_status !== "valid") {
      return json({ error: "Financial analysis requires the accepted active finalized design version" }, 409);
    }

    const { data: design, error: designError } = await db.from("designs")
      .select("id,active_version_id")
      .eq("id", version.design_id)
      .maybeSingle();
    if (designError) throw designError;
    if (!design || design.active_version_id !== version.id) {
      return json({ error: "Financial analysis requires the active finalized design version" }, 409);
    }

    let simulationQuery = db.from("simulation_runs")
      .select("*")
      .eq("design_version_id", version.id)
      .eq("status", "completed");
    if (body.simulation_run_id) simulationQuery = simulationQuery.eq("id", body.simulation_run_id);
    const { data: simulation, error: simulationError } = await simulationQuery
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (simulationError) throw simulationError;
    if (!simulation?.id || !simulation.result_hash || simulation.design_content_hash !== version.content_hash) {
      return json({ error: "Financial analysis requires a current completed simulation run" }, 409);
    }

    const capacityKw = Number(simulation.result_snapshot?.dc_capacity_kw ?? 0);
    const annualKwh = Number(simulation.result_snapshot?.year_1_energy_kwh ?? 0);
    if (!Number.isFinite(capacityKw) || capacityKw <= 0 || !Number.isFinite(annualKwh) || annualKwh <= 0) {
      return json({ error: "Simulation must contain positive capacity and year-1 energy" }, 409);
    }

    const capex = Number(body.capex);
    const annualOpex = Number(body.annual_opex ?? 0);
    const tariff = Number(body.energy_tariff);
    const exportTariff = Number(body.export_tariff ?? tariff);
    const selfConsumptionPercent = Number(body.self_consumption_percent ?? 80);
    const tariffEscalationPercent = Number(body.tariff_escalation_percent ?? 3);
    const degradationPercent = Number(body.degradation_percent ?? simulation.assumptions?.annual_degradation_percent ?? 0.5);
    const discountRatePercent = Number(body.discount_rate_percent ?? 8);
    const years = Math.min(30, Math.max(1, Math.floor(Number(body.years ?? simulation.assumptions?.years ?? 25))));

    if (!Number.isFinite(capex) || capex <= 0) return json({ error: "capex must be a positive number" }, 400);
    if (!Number.isFinite(annualOpex) || annualOpex < 0) return json({ error: "annual_opex must be a non-negative number" }, 400);
    if (!Number.isFinite(tariff) || tariff <= 0) return json({ error: "energy_tariff must be a positive number" }, 400);
    if (!Number.isFinite(exportTariff) || exportTariff < 0) return json({ error: "export_tariff must be a non-negative number" }, 400);
    if (!Number.isFinite(selfConsumptionPercent) || selfConsumptionPercent < 0 || selfConsumptionPercent > 100) return json({ error: "self_consumption_percent must be between 0 and 100" }, 400);
    if (!Number.isFinite(tariffEscalationPercent) || tariffEscalationPercent < -100) return json({ error: "tariff_escalation_percent is invalid" }, 400);
    if (!Number.isFinite(degradationPercent) || degradationPercent < 0 || degradationPercent > 100) return json({ error: "degradation_percent must be between 0 and 100" }, 400);
    if (!Number.isFinite(discountRatePercent) || discountRatePercent <= -100) return json({ error: "discount_rate_percent is invalid" }, 400);

    const rows: Array<Record<string, number>> = [];
    let cumulative = -capex;
    let npv = -capex;
    const discountRate = discountRatePercent / 100;
    for (let year = 1; year <= years; year += 1) {
      const generation = annualKwh * Math.pow(1 - degradationPercent / 100, year - 1);
      const retailTariff = tariff * Math.pow(1 + tariffEscalationPercent / 100, year - 1);
      const savings = generation * (selfConsumptionPercent / 100) * retailTariff
        + generation * (1 - selfConsumptionPercent / 100) * exportTariff
        - annualOpex;
      cumulative += savings;
      npv += savings / Math.pow(1 + discountRate, year);
      rows.push({
        year,
        generation_kwh: Math.round(generation),
        tariff: Number(retailTariff.toFixed(4)),
        savings: Number(savings.toFixed(2)),
        cumulative_cashflow: Number(cumulative.toFixed(2)),
      });
    }

    const paybackYear = rows.find((row) => row.cumulative_cashflow >= 0)?.year ?? null;
    const totalLifetimeSavings = rows.reduce((sum, row) => sum + row.savings, 0);
    const roiPercent = ((totalLifetimeSavings - capex) / capex) * 100;
    const assumptions = {
      capex,
      annual_opex: annualOpex,
      energy_tariff: tariff,
      export_tariff: exportTariff,
      self_consumption_percent: selfConsumptionPercent,
      tariff_escalation_percent: tariffEscalationPercent,
      degradation_percent: degradationPercent,
      discount_rate_percent: discountRatePercent,
      years,
    };
    const inputSnapshot = {
      design_version_id: version.id,
      simulation_run_id: simulation.id,
      source_simulation_result_hash: simulation.result_hash,
      simulation_provenance_class: simulation.provenance_class,
      system_capacity_kw: capacityKw,
      year_1_energy_kwh: annualKwh,
      ...assumptions,
    };
    const resultSnapshot = {
      system_capacity_kw: capacityKw,
      year_1_energy_kwh: Math.round(annualKwh),
      payback_year: paybackYear,
      total_lifetime_savings: Number(totalLifetimeSavings.toFixed(2)),
      npv: Number(npv.toFixed(2)),
      roi_percent: Number(roiPercent.toFixed(2)),
      annual: rows,
    };

    const { data: existing, error: existingError } = await db.from("financial_runs")
      .select("*")
      .eq("simulation_run_id", simulation.id)
      .eq("design_version_id", version.id)
      .eq("source_simulation_result_hash", simulation.result_hash)
      .eq("engine_name", ENGINE_NAME)
      .eq("engine_version", ENGINE_VERSION)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing && JSON.stringify(existing.input_snapshot) === JSON.stringify(inputSnapshot)) {
      return json({ success: true, design_version_id: version.id, simulation_run_id: simulation.id, financial_run: existing, assumptions, summary: existing.result_snapshot });
    }

    const { data: lastRun, error: lastRunError } = await db.from("financial_runs")
      .select("run_number")
      .eq("simulation_run_id", simulation.id)
      .order("run_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastRunError) throw lastRunError;

    const { data: financialRun, error: insertError } = await db.from("financial_runs").insert({
      simulation_run_id: simulation.id,
      design_version_id: version.id,
      run_number: Number(lastRun?.run_number ?? 0) + 1,
      status: "completed",
      engine_name: ENGINE_NAME,
      engine_version: ENGINE_VERSION,
      input_snapshot: inputSnapshot,
      result_snapshot: resultSnapshot,
      warnings: simulation.provenance_class === "reference" ? ["Financial results use reference production and are not bankable site-weather economics."] : [],
      source_simulation_result_hash: simulation.result_hash,
      created_by: user.id,
      completed_at: new Date().toISOString(),
    }).select("*").single();
    if (insertError) throw insertError;

    return json({
      success: true,
      design_version_id: version.id,
      simulation_run_id: simulation.id,
      financial_run: financialRun,
      assumptions,
      summary: resultSnapshot,
      engine: { name: ENGINE_NAME, version: ENGINE_VERSION },
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
