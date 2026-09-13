import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
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

async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function canonicalMesh(geometry: any): Array<{ x: number; y: number }> {
  const roof = geometry?.roof;
  const mesh = roof?.schemaVersion === 1 ? roof.mesh : Array.isArray(roof) ? roof : [];
  if (!Array.isArray(mesh)) return [];
  return mesh
    .map((point: any) => ({ x: Number(point?.x), y: Number(point?.y) }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function stringDistribution(panelCount: number, minSeries: number, maxSeries: number) {
  for (let stringCount = 1; stringCount <= panelCount; stringCount += 1) {
    const smallest = Math.floor(panelCount / stringCount);
    const largest = Math.ceil(panelCount / stringCount);
    if (smallest >= minSeries && largest <= maxSeries) {
      const base = Math.floor(panelCount / stringCount);
      const remainder = panelCount % stringCount;
      return Array.from({ length: stringCount }, (_, index) => base + (index < remainder ? 1 : 0));
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return out({ error: "POST required" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const authorization = req.headers.get("Authorization");
    if (!url || !anonKey) return out({ error: "Supabase environment is not configured" }, 500);
    if (!authorization) return out({ error: "Authorization header required" }, 401);

    const db = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: userError } = await db.auth.getUser();
    if (userError || !user) return out({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const designVersionId = String(body.design_version_id ?? body.designVersionId ?? "");
    if (!designVersionId) return out({ error: "design_version_id is required" }, 400);

    const { data: version, error: versionError } = await db.from("design_versions").select("*").eq("id", designVersionId).maybeSingle();
    if (versionError) throw versionError;
    if (!version) return out({ error: "Design version not found or access denied" }, 404);

    const { data: design, error: designError } = await db.from("designs").select("id,project_id,draft_version_id,active_version_id").eq("id", version.design_id).maybeSingle();
    if (designError) throw designError;
    if (!design) return out({ error: "Design not found or access denied" }, 404);

    if (version.status === "finalized" && design.active_version_id === version.id) {
      return out({ success: true, design_id: design.id, design_version_id: version.id, status: "finalized", already_finalized: true });
    }
    if (version.status !== "draft" || design.draft_version_id !== version.id) {
      return out({ error: "Only the current draft design version can be finalized" }, 409);
    }

    const mesh = canonicalMesh(version.geometry);
    if (mesh.length < 3) return out({ error: "Canonical roof geometry must contain at least three valid points" }, 422);
    const geometryHash = await sha256(version.geometry);
    const { error: geometryUpdateError } = await db.from("design_versions").update({
      geometry_validation_status: "valid",
      geometry_validation_errors: [],
      geometry_hash: geometryHash,
      geometry_validated_at: new Date().toISOString(),
      geometry_validated_by: user.id,
    }).eq("id", version.id).eq("status", "draft");
    if (geometryUpdateError) throw geometryUpdateError;

    const { data: layouts, error: layoutError } = await db.from("panel_layouts").select("*").eq("design_version_id", version.id).order("created_at", { ascending: true });
    if (layoutError) throw layoutError;
    const layout = version.active_layout_id
      ? (layouts ?? []).find((candidate: any) => candidate.id === version.active_layout_id)
      : (layouts ?? [])[0];
    if (!layout?.id || !layout.module_id || !layout.roof_id) return out({ error: "An active panel layout with roof and module identity is required" }, 422);

    const { data: placements, error: placementError } = await db.from("panel_placements").select("id,panel_index,string_number").eq("panel_layout_id", layout.id).order("panel_index", { ascending: true });
    if (placementError) throw placementError;
    const panelCount = placements?.length ?? 0;
    if (panelCount < 1 || panelCount !== Number(layout.panel_count ?? 0)) return out({ error: "Persisted panel placements must match the active layout panel count" }, 422);

    const { data: module, error: moduleError } = await db.from("solar_modules").select("id,power_w,voc_v,vmp_v,isc_a,imp_a").eq("id", layout.module_id).eq("active", true).maybeSingle();
    if (moduleError) throw moduleError;
    if (!module) return out({ error: "Active solar module not found" }, 422);
    const powerW = Number(module.power_w);
    const voc = Number(module.voc_v);
    const vmp = Number(module.vmp_v);
    const isc = Number(module.isc_a);
    const imp = Number(module.imp_a);
    if (![powerW, voc, vmp, isc, imp].every((value) => Number.isFinite(value) && value > 0)) {
      return out({ error: "Solar module electrical ratings are incomplete" }, 422);
    }

    const dcCapacityKw = panelCount * powerW / 1000;
    let inverter: any = null;
    if (body.inverter_id) {
      const { data, error } = await db.from("inverters").select("*").eq("id", body.inverter_id).eq("active", true).maybeSingle();
      if (error) throw error;
      inverter = data;
    } else {
      const { data, error } = await db.from("inverters").select("*").eq("active", true).gte("max_dc_power_kw", dcCapacityKw).order("rated_power_kw", { ascending: true }).limit(1).maybeSingle();
      if (error) throw error;
      inverter = data;
    }
    if (!inverter) return out({ error: "No active inverter can accept the design DC capacity" }, 422);

    const coldTempC = Number(body.cold_temp_c ?? -10);
    const hotTempC = Number(body.hot_temp_c ?? 70);
    const coldFactor = 1 + Math.max(0, Math.min(0.30, (25 - coldTempC) * 0.003));
    const hotFactor = 1 - Math.max(0, Math.min(0.30, (hotTempC - 25) * 0.003));
    const minSeries = Math.max(1, Math.ceil(Number(inverter.mppt_min_voltage_v) / (vmp * hotFactor)));
    const maxSeries = Math.max(1, Math.floor(Math.min(
      Number(inverter.max_voltage_v) / (voc * coldFactor),
      Number(inverter.mppt_max_voltage_v) / (vmp * hotFactor),
    )));
    if (!Number.isFinite(minSeries) || !Number.isFinite(maxSeries) || minSeries > maxSeries) {
      return out({ error: "No safe electrical string length exists for the selected inverter" }, 422);
    }

    const distribution = stringDistribution(panelCount, minSeries, maxSeries);
    if (!distribution) {
      return out({ error: `Panel count ${panelCount} cannot be distributed into safe strings of ${minSeries}-${maxSeries} modules` }, 422);
    }

    // Existing assignments must be cleared while their old strings still exist.
    // The assignment-integrity trigger allows NULL and prevents a panel from
    // pointing at a string that has not been persisted yet.
    const { error: clearAssignmentsError } = await db.from("panel_placements")
      .update({ string_number: null })
      .eq("panel_layout_id", layout.id);
    if (clearAssignmentsError) throw clearAssignmentsError;

    const { error: deleteStringsError } = await db.from("electrical_strings").delete().eq("design_version_id", version.id);
    if (deleteStringsError) throw deleteStringsError;

    let offset = 0;
    const stringRows: any[] = [];
    const assignments: Array<{ ids: string[]; stringNumber: number }> = [];
    for (let index = 0; index < distribution.length; index += 1) {
      const count = distribution[index];
      const ids = (placements ?? []).slice(offset, offset + count).map((placement: any) => placement.id);
      offset += count;
      const stringNumber = index + 1;
      assignments.push({ ids, stringNumber });
      stringRows.push({
        design_version_id: version.id,
        inverter_id: inverter.id,
        string_number: stringNumber,
        panel_count: count,
        voltage_v: Number((count * vmp).toFixed(2)),
        current_a: Number(imp.toFixed(2)),
        power_kw: Number((count * powerW / 1000).toFixed(3)),
        mppt_number: index % Math.max(1, Number(inverter.mppt_count ?? 1)) + 1,
        cold_temp_c: coldTempC,
        hot_temp_c: hotTempC,
        validation_status: "unchecked",
        warnings: [],
      });
    }

    // Persist the electrical authority before assigning panel foreign identity.
    const { error: insertStringsError } = await db.from("electrical_strings").insert(stringRows);
    if (insertStringsError) throw insertStringsError;

    for (const assignment of assignments) {
      const { error: assignmentError } = await db.from("panel_placements")
        .update({ string_number: assignment.stringNumber })
        .in("id", assignment.ids)
        .eq("panel_layout_id", layout.id);
      if (assignmentError) throw assignmentError;
    }

    const { data: topology, error: topologyError } = await db.rpc("validate_electrical_topology", { p_design_version_id: version.id });
    if (topologyError) throw topologyError;
    if (topology?.status !== "valid") return out({ error: "Electrical topology validation failed", topology }, 422);

    const { data: finalized, error: finalizeError } = await db.rpc("finalize_design_version", { p_design_version_id: version.id });
    if (finalizeError) throw finalizeError;

    return out({
      success: true,
      ...finalized,
      geometry_hash: geometryHash,
      inverter: { id: inverter.id, model: inverter.model, rated_power_kw: inverter.rated_power_kw },
      electrical: { strings: stringRows.length, min_series: minSeries, max_series: maxSeries, topology },
    });
  } catch (error) {
    console.error(error);
    return out(errorBody(error), 500);
  }
});
