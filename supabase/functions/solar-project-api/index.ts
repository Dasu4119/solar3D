import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const out = (x: unknown, s = 200) => new Response(JSON.stringify(x), { status: s, headers: cors });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_ANON_KEY");
    const auth = req.headers.get("Authorization");
    if (!url || !key) return out({ error: "Supabase environment is not configured" }, 500);
    if (!auth) return out({ error: "Authorization header required" }, 401);

    const db = createClient(url, key, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: ue } = await db.auth.getUser();
    if (ue || !user) return out({ error: "Unauthorized" }, 401);
    const b = await req.json();

    if (b.action === "get_design_for_project") {
      if (!b.project_id) return out({ error: "project_id is required" }, 400);
      const { data: design, error: de } = await db.from("designs").select("*").eq("project_id", b.project_id).order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (de) throw de;
      if (!design) return out({ success: true, design: null });
      return out({ success: true, design });
    }

    if (b.action === "get_design") {
      if (!b.design_id) return out({ error: "design_id is required" }, 400);
      const { data: design, error: de } = await db.from("designs").select("*").eq("id", b.design_id).single();
      if (de) throw de;
      const { data: versions, error: ve } = await db.from("design_versions").select("*").eq("design_id", b.design_id).order("version_number", { ascending: false });
      if (ve) throw ve;
      const active = versions?.find((v: any) => v.id === design.active_version_id) ?? versions?.[0] ?? null;
      const { data: roofs, error: re } = await db.from("roofs").select("*").eq("design_id", b.design_id);
      if (re) throw re;
      let layouts: any[] = [];
      let placements: any[] = [];
      if (active) {
        const { data: l, error: le } = await db.from("panel_layouts").select("*").eq("design_version_id", active.id);
        if (le) throw le;
        layouts = l ?? [];
        if (layouts.length) {
          const { data: p, error: pe } = await db.from("panel_placements").select("*").in("panel_layout_id", layouts.map((x: any) => x.id));
          if (pe) throw pe;
          placements = p ?? [];
        }
      }
      return out({ success: true, design, active_version: active, versions: versions ?? [], roofs: roofs ?? [], panel_layouts: layouts, panel_placements: placements });
    }

    if (b.action === "save_design") {
      if (!b.design_id) return out({ error: "design_id is required" }, 400);
      const { data: last, error: le } = await db.from("design_versions").select("version_number").eq("design_id", b.design_id).order("version_number", { ascending: false }).limit(1).maybeSingle();
      if (le) throw le;
      const n = (last?.version_number ?? 0) + 1;
      const roof = b.roof;
      let roofRow: any = null;

      if (roof?.geometry) {
        const rawGeometry = roof.geometry;
        const persistedGeometry = rawGeometry && typeof rawGeometry === "object" && !Array.isArray(rawGeometry) && rawGeometry.schemaVersion === 1
          ? rawGeometry
          : { schemaVersion: 1, mesh: rawGeometry, planes: Array.isArray(roof.planes) ? roof.planes : [] };
        const roofInput = {
          design_id: b.design_id,
          name: roof.name ?? "Roof",
          geometry: persistedGeometry,
          area_m2: roof.area_m2 ?? null,
          elevation_m: roof.elevation_m ?? 0,
          pitch_degrees: roof.pitch_degrees ?? 0,
          azimuth_degrees: roof.azimuth_degrees ?? 180,
          roof_type: roof.roof_type ?? "flat",
          ai_confidence: roof.ai_confidence ?? null,
        };
        const q = roof.id
          ? await db.from("roofs").update(roofInput).eq("id", roof.id).eq("design_id", b.design_id).select().single()
          : await db.from("roofs").insert(roofInput).select().single();
        if (q.error) throw q.error;
        roofRow = q.data;
      }

      const metrics = b.metrics ?? { panel_count: Array.isArray(b.panel_placements) ? b.panel_placements.length : 0 };
      const { data: version, error: ve } = await db.from("design_versions").insert({
        design_id: b.design_id,
        version_number: n,
        name: b.name ?? `Design v${n}`,
        change_summary: b.change_summary ?? "Saved from design editor",
        geometry: { roof: roofRow?.geometry ?? null },
        metrics,
        created_by: user.id,
      }).select().single();
      if (ve) throw ve;

      const placements = Array.isArray(b.panel_placements) ? b.panel_placements : [];
      let layout: any = null;
      if (placements.length || b.create_empty_layout) {
        const { data: l, error: le } = await db.from("panel_layouts").insert({
          design_version_id: version.id,
          roof_id: roofRow?.id ?? roof?.id ?? null,
          module_id: null,
          orientation_degrees: b.orientation_degrees ?? null,
          tilt_degrees: b.tilt_degrees ?? null,
          row_spacing_m: b.row_spacing_m ?? null,
          panel_spacing_m: b.panel_spacing_m ?? null,
          setback_m: b.setback_m ?? null,
          walkway_width_m: b.walkway_width_m ?? null,
          panel_count: placements.length,
          dc_capacity_kw: Number(b.dc_capacity_kw ?? 0),
          optimization_score: b.optimization_score ?? null,
        }).select().single();
        if (le) throw le;
        layout = l;
        if (placements.length) {
          const rows = placements.map((p: any, i: number) => ({
            panel_layout_id: l.id,
            panel_index: i + 1,
            x: Number(p.center?.x ?? p.x ?? 0),
            y: Number(p.center?.y ?? p.y ?? 0),
            z: Number(p.center?.z ?? p.z ?? 0),
            rotation_degrees: Number(p.rotation ?? p.rotation_degrees ?? 0),
            tilt_degrees: Number(p.tilt_degrees ?? 0),
            row_number: p.row_number ?? null,
            column_number: p.column_number ?? null,
            string_number: p.string_number ?? null,
          }));
          const { error: pe } = await db.from("panel_placements").insert(rows);
          if (pe) throw pe;
        }
      }

      const { data: updated, error: ae } = await db.from("designs").update({ active_version_id: version.id, status: "ready" }).eq("id", b.design_id).select().single();
      if (ae) throw ae;
      return out({ success: true, design: updated, design_version: version, roof: roofRow, panel_layout: layout });
    }

    if (b.action === "create_project") {
      const { data: customer, error: ce } = b.customer ? await db.from("customers").insert(b.customer).select().single() : { data: null, error: null };
      if (ce) throw ce;
      const { data: project, error: pe } = await db.from("projects").insert({ ...b.project, customer_id: customer?.id ?? b.project?.customer_id ?? null }).select().single();
      if (pe) throw pe;
      const { data: site, error: se } = await db.from("sites").insert({ project_id: project.id, ...(b.site ?? {}) }).select().single();
      if (se) throw se;
      const { data: design, error: de } = await db.from("designs").insert({ project_id: project.id, site_id: site.id, name: b.design_name ?? "Solar Design" }).select().single();
      if (de) throw de;
      const { data: version, error: ve } = await db.from("design_versions").insert({ design_id: design.id, version_number: 1, name: "Initial Design", change_summary: "Project created", geometry: {}, metrics: {}, created_by: user.id }).select().single();
      if (ve) throw ve;
      const { error: ae } = await db.from("designs").update({ active_version_id: version.id }).eq("id", design.id);
      if (ae) throw ae;
      return out({ success: true, customer, project, site, design, design_version: version });
    }

    return out({ error: "Unknown action. Use get_design, get_design_for_project, save_design, or create_project." }, 400);
  } catch (e) {
    console.error(e);
    return out({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
