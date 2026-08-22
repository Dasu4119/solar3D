import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const out = (x: unknown, s = 200) => new Response(JSON.stringify(x), { status: s, headers: cors });

async function requireProjectAccess(db: any, userId: string, projectId: string) {
  const { data: project, error: pe } = await db.from("projects").select("*").eq("id", projectId).single();
  if (pe || !project) return null;
  const { data: member, error: me } = await db.from("organization_members").select("role").eq("organization_id", project.organization_id).eq("user_id", userId).maybeSingle();
  if (me || !member) return null;
  return { project, role: member.role };
}

async function requireDesignAccess(db: any, userId: string, designId: string) {
  const { data: design, error: de } = await db.from("designs").select("*").eq("id", designId).single();
  if (de || !design) return null;
  const access = await requireProjectAccess(db, userId, design.project_id);
  return access ? { design, ...access } : null;
}

async function loadVersionContext(db: any, design: any) {
  const { data: versions, error: ve } = await db.from("design_versions").select("*").eq("design_id", design.id).order("version_number", { ascending: false });
  if (ve) throw ve;
  const draft = design.draft_version_id ? (versions ?? []).find((v: any) => v.id === design.draft_version_id) ?? null : null;
  const active = design.active_version_id ? (versions ?? []).find((v: any) => v.id === design.active_version_id) ?? null : null;
  const working = draft ?? active ?? null;
  return { versions: versions ?? [], draft, active, working };
}

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

    if (b.action === "list") {
      let organizationIds: string[] = [];
      if (b.organization_id || b.organizationId) {
        const orgId = b.organization_id ?? b.organizationId;
        const { data: member, error: me } = await db.from("organization_members").select("organization_id").eq("organization_id", orgId).eq("user_id", user.id).maybeSingle();
        if (me || !member) return out({ error: "Access denied" }, 403);
        organizationIds = [orgId];
      } else {
        const { data: members, error: me } = await db.from("organization_members").select("organization_id").eq("user_id", user.id);
        if (me) throw me;
        organizationIds = (members ?? []).map((row: any) => row.organization_id);
      }
      if (!organizationIds.length) return out([]);
      const { data: projects, error: pe } = await db.from("projects").select("*").in("organization_id", organizationIds).order("created_at", { ascending: false });
      if (pe) throw pe;
      return out(projects ?? []);
    }

    if (b.action === "get") {
      const projectId = b.project_id ?? b.projectId;
      if (!projectId) return out({ error: "project_id is required" }, 400);
      const access = await requireProjectAccess(db, user.id, projectId);
      if (!access) return out({ error: "Project not found or access denied" }, 404);
      return out(access.project);
    }

    if (b.action === "sites") {
      const projectId = b.project_id ?? b.projectId;
      if (!projectId) return out({ error: "project_id is required" }, 400);
      if (!await requireProjectAccess(db, user.id, projectId)) return out({ error: "Project not found or access denied" }, 404);
      const { data: sites, error: se } = await db.from("sites").select("*").eq("project_id", projectId).order("created_at", { ascending: true });
      if (se) throw se;
      return out(sites ?? []);
    }

    if (b.action === "get_design_context") {
      if (!b.project_id) return out({ error: "project_id is required" }, 400);
      const access = await requireProjectAccess(db, user.id, b.project_id);
      if (!access) return out({ error: "Project not found or access denied" }, 404);
      const { data: design, error: de } = await db.from("designs").select("*").eq("project_id", b.project_id).order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (de) throw de;
      if (!design) return out({ error: "No design exists for project" }, 404);
      const { draft, active, working } = await loadVersionContext(db, design);
      const { data: roofs, error: re } = await db.from("roofs").select("*").eq("design_id", design.id).order("created_at", { ascending: true });
      if (re) throw re;
      let layouts: any[] = [];
      if (working) {
        const { data: l, error: le } = await db.from("panel_layouts").select("*").eq("design_version_id", working.id).order("created_at", { ascending: true });
        if (le) throw le;
        layouts = l ?? [];
      }
      const selectedLayout = working?.active_layout_id ? layouts.find((l: any) => l.id === working.active_layout_id) ?? null : layouts[0] ?? null;
      const { data: defaults, error: de2 } = await db.from("solar_design_defaults").select("default_roof_geometry,setback_north_m,setback_east_m,setback_south_m,setback_west_m,default_module_id").eq("id", true).single();
      if (de2) throw de2;
      const moduleId = selectedLayout?.module_id ?? defaults.default_module_id;
      const { data: module, error: me } = await db.from("solar_modules").select("id,manufacturer,model,power_w,efficiency_percent,length_m,width_m").eq("id", moduleId).eq("active", true).single();
      if (me) throw me;
      return out({
        success: true,
        project: access.project,
        design,
        draft_version: draft,
        active_version: active,
        working_version: working,
        roofs: roofs ?? [],
        layout: selectedLayout,
        defaults: { roof: defaults.default_roof_geometry, setback: { northM: defaults.setback_north_m, eastM: defaults.setback_east_m, southM: defaults.setback_south_m, westM: defaults.setback_west_m } },
        module: { id: module.id, manufacturer: module.manufacturer, model: module.model, widthM: Number(module.width_m), lengthM: Number(module.length_m), powerWatts: Number(module.power_w), efficiency: Number(module.efficiency_percent ?? 0) / 100 },
      });
    }

    if (b.action === "get_design_for_project") {
      if (!b.project_id) return out({ error: "project_id is required" }, 400);
      if (!await requireProjectAccess(db, user.id, b.project_id)) return out({ error: "Project not found or access denied" }, 404);
      const { data: design, error: de } = await db.from("designs").select("*").eq("project_id", b.project_id).order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (de) throw de;
      return out({ success: true, design: design ?? null });
    }

    if (b.action === "get_design") {
      if (!b.design_id) return out({ error: "design_id is required" }, 400);
      const access = await requireDesignAccess(db, user.id, b.design_id);
      if (!access) return out({ error: "Design not found or access denied" }, 404);
      const { data: design, error: de } = await db.from("designs").select("*").eq("id", b.design_id).single();
      if (de) throw de;
      const { versions, draft, active, working } = await loadVersionContext(db, design);
      const { data: roofs, error: re } = await db.from("roofs").select("*").eq("design_id", b.design_id);
      if (re) throw re;
      let layouts: any[] = [], placements: any[] = [];
      if (working) {
        const { data: l, error: le } = await db.from("panel_layouts").select("*").eq("design_version_id", working.id);
        if (le) throw le;
        layouts = l ?? [];
        if (layouts.length) {
          const { data: p, error: pe } = await db.from("panel_placements").select("*").in("panel_layout_id", layouts.map((x: any) => x.id));
          if (pe) throw pe;
          placements = p ?? [];
        }
      }
      return out({ success: true, design, draft_version: draft, active_version: active, working_version: working, versions, roofs: roofs ?? [], panel_layouts: layouts, panel_placements: placements });
    }

    if (b.action === "save_design") {
      if (!b.design_id) return out({ error: "design_id is required" }, 400);
      const access = await requireDesignAccess(db, user.id, b.design_id);
      if (!access) return out({ error: "Design not found or access denied" }, 404);

      const { data: current, error: ce } = await db.from("designs").select("*").eq("id", b.design_id).single();
      if (ce) throw ce;
      let version: any = null;
      if (current.draft_version_id) {
        const { data: existingDraft, error: de } = await db.from("design_versions").select("*").eq("id", current.draft_version_id).eq("design_id", b.design_id).eq("status", "draft").maybeSingle();
        if (de) throw de;
        version = existingDraft;
      }
      if (!version) {
        const { data: last, error: le } = await db.from("design_versions").select("version_number").eq("design_id", b.design_id).order("version_number", { ascending: false }).limit(1).maybeSingle();
        if (le) throw le;
        const n = Number(last?.version_number ?? 0) + 1;
        const { data: created, error: ve } = await db.from("design_versions").insert({ design_id: b.design_id, version_number: n, name: b.name ?? `Design v${n}`, change_summary: b.change_summary ?? "Working draft", geometry: { roof: null }, metrics: b.metrics ?? { panel_count: Array.isArray(b.panel_placements) ? b.panel_placements.length : 0 }, created_by: user.id, status: "draft" }).select().single();
        if (ve) throw ve;
        version = created;
        const { error: pe } = await db.from("designs").update({ draft_version_id: version.id, updated_at: new Date().toISOString() }).eq("id", b.design_id);
        if (pe) throw pe;
      }

      let roofRow: any = null;
      if (b.roof?.geometry) {
        const rawGeometry = b.roof.geometry;
        const persistedGeometry = rawGeometry && typeof rawGeometry === "object" && !Array.isArray(rawGeometry) && rawGeometry.schemaVersion === 1
          ? rawGeometry
          : { schemaVersion: 1, mesh: rawGeometry, planes: [] };
        const roofInput = {
          design_id: b.design_id,
          name: b.roof.name ?? "Roof",
          geometry: persistedGeometry,
          area_m2: b.roof.area_m2 ?? null,
          elevation_m: b.roof.elevation_m ?? 0,
          pitch_degrees: b.roof.pitch_degrees ?? 0,
          azimuth_degrees: b.roof.azimuth_degrees ?? 180,
          roof_type: b.roof.roof_type ?? "flat",
          ai_confidence: b.roof.ai_confidence ?? null,
        };
        const query = b.roof.id
          ? await db.from("roofs").update(roofInput).eq("id", b.roof.id).eq("design_id", b.design_id).select().single()
          : await db.from("roofs").insert(roofInput).select().single();
        if (query.error) throw query.error;
        roofRow = query.data;
        const { error: ve } = await db.from("design_versions").update({ geometry: { roof: roofRow.geometry }, metrics: b.metrics ?? { panel_count: Array.isArray(b.panel_placements) ? b.panel_placements.length : 0 }, change_summary: b.change_summary ?? "Working draft updated" }).eq("id", version.id).eq("status", "draft");
        if (ve) throw ve;
      }

      const placements = Array.isArray(b.panel_placements) ? b.panel_placements : [];
      let layout: any = null;
      const { data: existingLayouts, error: el } = await db.from("panel_layouts").select("*").eq("design_version_id", version.id).order("created_at", { ascending: true });
      if (el) throw el;
      if (existingLayouts?.length) {
        layout = existingLayouts[0];
        const { error: lu } = await db.from("panel_layouts").update({
          roof_id: roofRow?.id ?? b.roof_id ?? layout.roof_id,
          module_id: b.module_id ?? layout.module_id,
          orientation_degrees: b.orientation_degrees ?? layout.orientation_degrees,
          tilt_degrees: b.tilt_degrees ?? layout.tilt_degrees,
          row_spacing_m: b.row_spacing_m ?? layout.row_spacing_m,
          panel_spacing_m: b.panel_spacing_m ?? layout.panel_spacing_m,
          setback_m: b.setback_m ?? layout.setback_m,
          setback_north_m: b.setback_north_m ?? b.setbacks?.northM ?? layout.setback_north_m,
          setback_east_m: b.setback_east_m ?? b.setbacks?.eastM ?? layout.setback_east_m,
          setback_south_m: b.setback_south_m ?? b.setbacks?.southM ?? layout.setback_south_m,
          setback_west_m: b.setback_west_m ?? b.setbacks?.westM ?? layout.setback_west_m,
          walkway_width_m: b.walkway_width_m ?? layout.walkway_width_m,
          panel_count: placements.length,
          dc_capacity_kw: Number(b.dc_capacity_kw ?? 0),
          optimization_score: b.optimization_score ?? null,
        }).eq("id", layout.id);
        if (lu.error) throw lu.error;
        const { error: pd } = await db.from("panel_placements").delete().eq("panel_layout_id", layout.id);
        if (pd) throw pd;
      } else if (placements.length || b.create_empty_layout) {
        const { data: l, error: le } = await db.from("panel_layouts").insert({
          design_version_id: version.id,
          roof_id: roofRow?.id ?? b.roof_id ?? null,
          module_id: b.module_id ?? null,
          orientation_degrees: b.orientation_degrees ?? null,
          tilt_degrees: b.tilt_degrees ?? null,
          row_spacing_m: b.row_spacing_m ?? null,
          panel_spacing_m: b.panel_spacing_m ?? null,
          setback_m: b.setback_m ?? null,
          setback_north_m: b.setback_north_m ?? b.setbacks?.northM ?? null,
          setback_east_m: b.setback_east_m ?? b.setbacks?.eastM ?? null,
          setback_south_m: b.setback_south_m ?? b.setbacks?.southM ?? null,
          setback_west_m: b.setback_west_m ?? b.setbacks?.westM ?? null,
          walkway_width_m: b.walkway_width_m ?? null,
          panel_count: placements.length,
          dc_capacity_kw: Number(b.dc_capacity_kw ?? 0),
          optimization_score: b.optimization_score ?? null,
        }).select().single();
        if (le) throw le;
        layout = l;
      }

      if (layout && placements.length) {
        const rows = placements.map((p: any, i: number) => ({ panel_layout_id: layout.id, panel_index: i + 1, x: Number(p.center?.x ?? p.x ?? 0), y: Number(p.center?.y ?? p.y ?? 0), z: Number(p.center?.z ?? p.z ?? 0), rotation_degrees: Number(p.rotation ?? p.rotation_degrees ?? 0), tilt_degrees: Number(p.tilt_degrees ?? 0), row_number: p.row_number ?? null, column_number: p.column_number ?? null, string_number: p.string_number ?? null, module_id: p.module_id ?? b.module_id ?? layout.module_id, roof_id: p.roof_id ?? layout.roof_id }));
        const { error: pe } = await db.from("panel_placements").insert(rows);
        if (pe) throw pe;
      }

      if (layout) {
        const { error: va } = await db.from("design_versions").update({ active_layout_id: layout.id }).eq("id", version.id).eq("status", "draft");
        if (va) throw va;
      }

      const { data: updated, error: ue2 } = await db.from("designs").update({ draft_version_id: version.id, updated_at: new Date().toISOString() }).eq("id", b.design_id).select().single();
      if (ue2) throw ue2;
      return out({ success: true, design: updated, draft_version: version, active_version_id: updated.active_version_id ?? null, roof: roofRow, panel_layout: layout });
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
      return out({ success: true, customer, project, site, design });
    }

    return out({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return out({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});