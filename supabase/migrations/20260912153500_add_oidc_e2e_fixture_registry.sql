-- GitHub OIDC authenticated release-gate fixtures.
-- The permanent B fixture contains synthetic records only. Per-run A fixtures and
-- temporary auth identities are created/removed by ci-e2e-bootstrap.

create table if not exists public.ci_e2e_fixture_registry (
  id boolean primary key default true check (id),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  design_id uuid not null references public.designs(id) on delete cascade,
  design_version_id uuid not null references public.design_versions(id) on delete cascade,
  roof_id uuid not null references public.roofs(id) on delete cascade,
  panel_layout_id uuid not null references public.panel_layouts(id) on delete cascade,
  simulation_run_id uuid not null references public.simulation_runs(id) on delete restrict,
  financial_run_id uuid not null references public.financial_runs(id) on delete restrict,
  bom_run_id uuid not null references public.bom_runs(id) on delete restrict,
  proposal_run_id uuid not null references public.proposal_runs(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.ci_e2e_fixture_registry enable row level security;
revoke all on public.ci_e2e_fixture_registry from anon, authenticated;
grant select on public.ci_e2e_fixture_registry to service_role;

create table if not exists public.ci_e2e_runs (
  fixture_id uuid primary key,
  organization_a_id uuid not null references public.organizations(id) on delete cascade,
  user_a_id uuid not null,
  user_b_id uuid not null,
  created_at timestamptz not null default now()
);

alter table public.ci_e2e_runs enable row level security;
revoke all on public.ci_e2e_runs from anon, authenticated;
grant select, insert, update, delete on public.ci_e2e_runs to service_role;

do $$
declare
  v_org uuid;
  v_project uuid;
  v_site uuid;
  v_design uuid;
  v_version uuid;
  v_roof uuid;
  v_layout uuid;
  v_sim uuid;
  v_fin uuid;
  v_bom uuid;
  v_proposal uuid;
  v_sim_hash text;
  v_fin_hash text;
  v_bom_hash text;
begin
  if not exists (select 1 from public.ci_e2e_fixture_registry where id = true) then
    insert into public.organizations(name, slug)
    values ('Solar3D CI Isolation Fixture B', '__solar3d_ci_fixture_b__')
    returning id into v_org;

    insert into public.projects(organization_id, name, status, country, notes)
    values (v_org, 'Solar3D CI Org B Project', 'draft', 'India', 'Synthetic release-gate fixture; not customer data')
    returning id into v_project;

    insert into public.sites(project_id, name, latitude, longitude)
    values (v_project, 'CI Org B Site', 16.3067, 80.4365)
    returning id into v_site;

    insert into public.designs(project_id, site_id, name, status)
    values (v_project, v_site, 'CI Org B Design', 'draft')
    returning id into v_design;

    insert into public.design_versions(design_id, version_number, name, change_summary, geometry, metrics, status)
    values (v_design, 1, 'CI Org B v1', 'Synthetic organization-isolation fixture', '{}'::jsonb, '{}'::jsonb, 'draft')
    returning id into v_version;

    insert into public.roofs(design_id, name, geometry, area_m2, elevation_m, pitch_degrees, azimuth_degrees, roof_type)
    values (
      v_design,
      'CI Org B Roof',
      '[{"x":0,"y":0},{"x":10,"y":0},{"x":10,"y":6},{"x":0,"y":6}]'::jsonb,
      60, 0, 0, 180, 'flat'
    )
    returning id into v_roof;

    insert into public.panel_layouts(design_version_id, roof_id, panel_count, dc_capacity_kw, setback_m)
    values (v_version, v_roof, 0, 0, 0.3)
    returning id into v_layout;

    update public.design_versions set active_layout_id = v_layout where id = v_version;
    update public.designs set active_version_id = v_version, draft_version_id = v_version where id = v_design;

    insert into public.simulation_runs(
      design_version_id, run_number, status, engine_version, input_snapshot,
      weather_source, assumptions, result_snapshot, provenance_class, completed_at
    ) values (
      v_version, 1, 'completed', 'ci-fixture-1',
      '{"ci_fixture":true}'::jsonb, '{}'::jsonb, '{}'::jsonb,
      '{"annual_kwh":1}'::jsonb, 'reference', now()
    ) returning id, result_hash into v_sim, v_sim_hash;

    insert into public.financial_runs(
      simulation_run_id, design_version_id, run_number, status, engine_version,
      input_snapshot, result_snapshot, warnings, source_simulation_result_hash, completed_at
    ) values (
      v_sim, v_version, 1, 'completed', 'ci-fixture-1',
      '{"ci_fixture":true}'::jsonb, '{"npv":0}'::jsonb, '[]'::jsonb,
      v_sim_hash, now()
    ) returning id, result_hash into v_fin, v_fin_hash;

    insert into public.bom_runs(
      financial_run_id, design_version_id, run_number, status, engine_version,
      input_snapshot, result_snapshot, source_financial_result_hash, completed_at
    ) values (
      v_fin, v_version, 1, 'completed', 'ci-fixture-1',
      '{"ci_fixture":true}'::jsonb, '{"items":[]}'::jsonb,
      v_fin_hash, now()
    ) returning id, result_hash into v_bom, v_bom_hash;

    insert into public.proposal_runs(
      bom_run_id, financial_run_id, design_version_id, run_number, status,
      engine_version, input_snapshot, result_snapshot, source_bom_result_hash,
      source_financial_result_hash, completed_at
    ) values (
      v_bom, v_fin, v_version, 1, 'completed', 'ci-fixture-1',
      '{"ci_fixture":true}'::jsonb, '{"proposal":true}'::jsonb,
      v_bom_hash, v_fin_hash, now()
    ) returning id into v_proposal;

    insert into public.ci_e2e_fixture_registry(
      id, organization_id, project_id, site_id, design_id, design_version_id,
      roof_id, panel_layout_id, simulation_run_id, financial_run_id, bom_run_id, proposal_run_id
    ) values (
      true, v_org, v_project, v_site, v_design, v_version,
      v_roof, v_layout, v_sim, v_fin, v_bom, v_proposal
    );
  end if;
end $$;
