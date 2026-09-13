-- FK cascades can remove parent organization/design rows before child immutability
-- triggers execute, so lineage lookup is not reliable inside those triggers.
-- The verified cleanup RPC validates the reserved CI namespace first, then sets a
-- transaction-local flag. Only service_role + that flag may delete immutable rows.

create or replace function public.prevent_simulation_run_mutation()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
begin
  if tg_op = 'DELETE'
     and auth.role() = 'service_role'
     and current_setting('solar3d.ci_cleanup', true) = 'verified' then
    return old;
  end if;
  raise exception 'simulation_runs are immutable; create a new run instead';
end;
$$;

create or replace function public.prevent_financial_run_mutation()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
begin
  if tg_op = 'DELETE'
     and auth.role() = 'service_role'
     and current_setting('solar3d.ci_cleanup', true) = 'verified' then
    return old;
  end if;
  raise exception 'financial_runs are immutable; create a new run instead';
end;
$$;

create or replace function public.prevent_commercial_output_mutation()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
begin
  if tg_op = 'DELETE'
     and auth.role() = 'service_role'
     and current_setting('solar3d.ci_cleanup', true) = 'verified' then
    return old;
  end if;
  raise exception 'commercial output snapshots are immutable; create a new run instead';
end;
$$;

create or replace function public.validate_design_version_state()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if auth.role() = 'service_role'
       and current_setting('solar3d.ci_cleanup', true) = 'verified' then
      return old;
    end if;
    if old.status in ('finalized','superseded','archived') then
      raise exception 'design_versions are immutable after finalization; create a new version instead';
    end if;
    return old;
  end if;

  if old.status in ('finalized','superseded','archived') then
    if new.design_id is distinct from old.design_id
       or new.version_number is distinct from old.version_number
       or new.name is distinct from old.name
       or new.change_summary is distinct from old.change_summary
       or new.geometry is distinct from old.geometry
       or new.metrics is distinct from old.metrics
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at
       or new.content_hash is distinct from old.content_hash then
      raise exception 'design_versions are immutable after finalization; create a new version instead';
    end if;
    if old.status = 'finalized' and new.status not in ('finalized','superseded') then
      raise exception 'finalized design versions may only remain finalized or become superseded';
    end if;
    if old.status in ('superseded','archived') and new.status is distinct from old.status then
      raise exception 'superseded or archived design versions cannot change state';
    end if;
  end if;

  if new.status in ('finalized','superseded','archived') and old.status is distinct from new.status then
    new.finalized_at := coalesce(old.finalized_at, now());
    new.finalized_by := coalesce(old.finalized_by, auth.uid());
  end if;

  new.content_hash := public.design_version_content_hash(new);
  return new;
end;
$$;

create or replace function public.cleanup_ci_e2e_organization(p_organization_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_org public.organizations%rowtype;
  v_proposals integer := 0;
  v_boms integer := 0;
  v_engineering integer := 0;
  v_financial integer := 0;
  v_simulations integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'CI cleanup requires service_role';
  end if;

  select * into v_org
  from public.organizations
  where id = p_organization_id
  for update;

  if not found then
    return jsonb_build_object('success', true, 'already_absent', true, 'organization_id', p_organization_id);
  end if;

  if v_org.slug not like '__solar3d_ci_a_%'
     or v_org.name not like 'Solar3D CI Org A %' then
    raise exception 'Refusing to clean non-CI organization %', p_organization_id;
  end if;

  perform set_config('solar3d.ci_cleanup', 'verified', true);

  delete from public.proposal_runs pr
  using public.design_versions dv, public.designs d, public.projects p
  where pr.design_version_id = dv.id and dv.design_id = d.id and d.project_id = p.id and p.organization_id = p_organization_id;
  get diagnostics v_proposals = row_count;

  delete from public.bom_runs br
  using public.design_versions dv, public.designs d, public.projects p
  where br.design_version_id = dv.id and dv.design_id = d.id and d.project_id = p.id and p.organization_id = p_organization_id;
  get diagnostics v_boms = row_count;

  delete from public.engineering_results er
  using public.design_versions dv, public.designs d, public.projects p
  where er.design_version_id = dv.id and dv.design_id = d.id and d.project_id = p.id and p.organization_id = p_organization_id;
  get diagnostics v_engineering = row_count;

  delete from public.financial_runs fr
  using public.design_versions dv, public.designs d, public.projects p
  where fr.design_version_id = dv.id and dv.design_id = d.id and d.project_id = p.id and p.organization_id = p_organization_id;
  get diagnostics v_financial = row_count;

  delete from public.simulation_runs sr
  using public.design_versions dv, public.designs d, public.projects p
  where sr.design_version_id = dv.id and dv.design_id = d.id and d.project_id = p.id and p.organization_id = p_organization_id;
  get diagnostics v_simulations = row_count;

  delete from public.organizations where id = p_organization_id;

  if exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'CI organization % remained after cleanup', p_organization_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'verified_cleanup', true,
    'organization_id', p_organization_id,
    'deleted', jsonb_build_object(
      'proposal_runs', v_proposals,
      'bom_runs', v_boms,
      'engineering_results', v_engineering,
      'financial_runs', v_financial,
      'simulation_runs', v_simulations
    )
  );
end;
$$;

revoke all on function public.cleanup_ci_e2e_organization(uuid) from public, anon, authenticated;
grant execute on function public.cleanup_ci_e2e_organization(uuid) to service_role;
