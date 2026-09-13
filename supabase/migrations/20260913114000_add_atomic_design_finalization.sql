-- Solar3D RC: close the draft -> finalized lifecycle gap without weakening existing gates.
-- The built-in reference module must carry complete electrical ratings because
-- electrical-string integrity validation refuses incomplete module data.

update public.solar_modules
set
  voc_v = coalesce(voc_v, 48.0),
  vmp_v = coalesce(vmp_v, 40.0),
  isc_a = coalesce(isc_a, 10.5),
  imp_a = coalesce(imp_a, 10.0)
where manufacturer = 'Solar3D'
  and model = '400W Reference'
  and power_w = 400;

create or replace function public.finalize_design_version(p_design_version_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_version public.design_versions;
  v_design public.designs;
  v_org_id uuid;
begin
  select * into v_version
  from public.design_versions
  where id = p_design_version_id
  for update;

  if not found then
    raise exception 'Design version not found';
  end if;

  select d.*, p.organization_id
  into v_design, v_org_id
  from public.designs d
  join public.projects p on p.id = d.project_id
  where d.id = v_version.design_id;

  if not found or not public.is_org_member(v_org_id) then
    raise exception 'Design version not found or access denied';
  end if;

  if v_version.status <> 'draft' then
    raise exception 'Only a draft design version can be finalized';
  end if;

  if v_version.geometry_schema_version <> 1
     or v_version.geometry_validation_status <> 'valid'
     or v_version.geometry_hash is null
     or v_version.geometry_validated_at is null
     or v_version.geometry_validated_by is null then
    raise exception 'Design version cannot be finalized until persisted geometry validation passes';
  end if;

  if v_version.electrical_topology_status <> 'valid'
     or v_version.electrical_topology_hash is null
     or v_version.electrical_topology_validated_at is null then
    raise exception 'Design version cannot be finalized until electrical topology validation passes';
  end if;

  -- Clear the mutable pointer first inside the same transaction, then make the
  -- version immutable and promote it as the active engineering version.
  update public.designs
  set draft_version_id = null,
      updated_at = now()
  where id = v_version.design_id;

  update public.design_versions
  set status = 'finalized'
  where id = p_design_version_id;

  update public.designs
  set active_version_id = p_design_version_id,
      status = 'ready',
      updated_at = now()
  where id = v_version.design_id;

  return jsonb_build_object(
    'success', true,
    'design_id', v_version.design_id,
    'design_version_id', p_design_version_id,
    'status', 'finalized'
  );
end;
$$;

grant execute on function public.finalize_design_version(uuid) to authenticated;
revoke execute on function public.finalize_design_version(uuid) from anon;
