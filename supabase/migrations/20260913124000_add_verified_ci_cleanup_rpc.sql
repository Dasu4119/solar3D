-- Delete a complete ephemeral Org-A release-gate fixture without weakening
-- customer immutability. This RPC is executable only by service_role and refuses
-- any organization outside the reserved CI namespace.

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

  delete from public.proposal_runs pr
  using public.design_versions dv, public.designs d, public.projects p
  where pr.design_version_id = dv.id
    and dv.design_id = d.id
    and d.project_id = p.id
    and p.organization_id = p_organization_id;
  get diagnostics v_proposals = row_count;

  delete from public.bom_runs br
  using public.design_versions dv, public.designs d, public.projects p
  where br.design_version_id = dv.id
    and dv.design_id = d.id
    and d.project_id = p.id
    and p.organization_id = p_organization_id;
  get diagnostics v_boms = row_count;

  delete from public.engineering_results er
  using public.design_versions dv, public.designs d, public.projects p
  where er.design_version_id = dv.id
    and dv.design_id = d.id
    and d.project_id = p.id
    and p.organization_id = p_organization_id;
  get diagnostics v_engineering = row_count;

  delete from public.financial_runs fr
  using public.design_versions dv, public.designs d, public.projects p
  where fr.design_version_id = dv.id
    and dv.design_id = d.id
    and d.project_id = p.id
    and p.organization_id = p_organization_id;
  get diagnostics v_financial = row_count;

  delete from public.simulation_runs sr
  using public.design_versions dv, public.designs d, public.projects p
  where sr.design_version_id = dv.id
    and dv.design_id = d.id
    and d.project_id = p.id
    and p.organization_id = p_organization_id;
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
