-- Release-gate fixtures intentionally exercise immutable production lineage.
-- Permit deletion only when BOTH conditions hold:
--   1) the caller is the service_role used by the OIDC bootstrap function; and
--   2) the lineage belongs to the reserved CI organization namespace.
-- Customer/normal immutable records keep their existing protections unchanged.

create or replace function private.is_ci_e2e_design_version(p_design_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.design_versions dv
    join public.designs d on d.id = dv.design_id
    join public.projects p on p.id = d.project_id
    join public.organizations o on o.id = p.organization_id
    where dv.id = p_design_version_id
      and o.slug like '__solar3d_ci_a_%'
      and o.name like 'Solar3D CI Org A %'
  );
$$;

revoke all on function private.is_ci_e2e_design_version(uuid) from public, anon, authenticated;
grant execute on function private.is_ci_e2e_design_version(uuid) to service_role;

create or replace function public.prevent_simulation_run_mutation()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
begin
  if tg_op = 'DELETE'
     and auth.role() = 'service_role'
     and private.is_ci_e2e_design_version(old.design_version_id) then
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
     and private.is_ci_e2e_design_version(old.design_version_id) then
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
     and private.is_ci_e2e_design_version(old.design_version_id) then
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
       and private.is_ci_e2e_design_version(old.id) then
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
