alter table public.design_versions
  add column if not exists acceptance_status text not null default 'pending',
  add column if not exists acceptance_errors jsonb not null default '[]'::jsonb,
  add column if not exists acceptance_warnings jsonb not null default '[]'::jsonb,
  add column if not exists acceptance_hash text,
  add column if not exists acceptance_validated_at timestamptz,
  add column if not exists acceptance_validated_by uuid references auth.users(id);

alter table public.design_versions
  drop constraint if exists design_versions_acceptance_status_check;
alter table public.design_versions
  add constraint design_versions_acceptance_status_check
  check (acceptance_status in ('pending','valid','invalid','warning'));

create index if not exists idx_design_versions_acceptance_status on public.design_versions (acceptance_status);
create index if not exists idx_design_versions_acceptance_validated_by on public.design_versions (acceptance_validated_by);

create or replace function public.validate_design_acceptance_gate(p_design_version_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  dv record; sim record; eng record;
  errors jsonb := '[]'::jsonb; warnings jsonb := '[]'::jsonb;
  result_status text := 'valid'; v_acceptance_hash text; payload text;
begin
  select * into dv from public.design_versions where id = p_design_version_id for update;
  if not found then raise exception 'design version % not found', p_design_version_id; end if;
  if dv.status <> 'finalized' then errors := errors || jsonb_build_array(jsonb_build_object('code','DESIGN_NOT_FINALIZED','message','Design version must be finalized before acceptance.')); end if;
  if dv.geometry_validation_status <> 'valid' or dv.geometry_hash is null then errors := errors || jsonb_build_array(jsonb_build_object('code','GEOMETRY_NOT_VALID','message','Canonical geometry validation is not valid.')); end if;
  if dv.electrical_topology_status <> 'valid' or dv.electrical_topology_hash is null then errors := errors || jsonb_build_array(jsonb_build_object('code','ELECTRICAL_TOPOLOGY_NOT_VALID','message','Electrical topology validation is not valid.')); end if;
  select * into sim from public.simulation_runs where design_version_id = p_design_version_id and status = 'completed' order by created_at desc limit 1;
  if sim.id is null then errors := errors || jsonb_build_array(jsonb_build_object('code','SIMULATION_NOT_COMPLETED','message','A completed simulation run is required.')); elsif sim.input_hash is null or sim.result_hash is null or sim.engine_version is null then errors := errors || jsonb_build_array(jsonb_build_object('code','SIMULATION_PROVENANCE_INCOMPLETE','message','Simulation provenance hashes and engine version are required.')); end if;
  select * into eng from public.engineering_results where design_version_id = p_design_version_id order by created_at desc limit 1;
  if eng.id is null then errors := errors || jsonb_build_array(jsonb_build_object('code','ENGINEERING_RESULT_MISSING','message','An engineering result is required.')); else
    if eng.validation_status <> 'valid' then errors := errors || jsonb_build_array(jsonb_build_object('code','ENGINEERING_RESULT_NOT_VALID','message','The latest engineering result is not valid.')); end if;
    if sim.id is not null and eng.source_simulation_run_id <> sim.id then errors := errors || jsonb_build_array(jsonb_build_object('code','ENGINEERING_RESULT_PROVENANCE_MISMATCH','message','Engineering result is not sourced from the latest completed simulation run.')); end if;
    if eng.result_hash is null or eng.engine_version is null then errors := errors || jsonb_build_array(jsonb_build_object('code','ENGINEERING_PROVENANCE_INCOMPLETE','message','Engineering result provenance is incomplete.')); end if;
  end if;
  if jsonb_array_length(errors) > 0 then result_status := 'invalid'; elsif jsonb_array_length(warnings) > 0 then result_status := 'warning'; end if;
  payload := concat_ws('|', p_design_version_id::text, coalesce(dv.content_hash,''), coalesce(dv.geometry_hash,''), coalesce(dv.electrical_topology_hash,''), coalesce(sim.id::text,''), coalesce(sim.input_hash,''), coalesce(sim.result_hash,''), coalesce(sim.engine_version,''), coalesce(eng.id::text,''), coalesce(eng.result_hash,''), coalesce(eng.engine_version,''));
  v_acceptance_hash := encode(extensions.digest(payload::bytea, 'sha256'), 'hex');
  update public.design_versions set acceptance_status=result_status, acceptance_errors=errors, acceptance_warnings=warnings, acceptance_hash=v_acceptance_hash, acceptance_validated_at=now() where id=p_design_version_id;
  return jsonb_build_object('design_version_id',p_design_version_id,'status',result_status,'errors',errors,'warnings',warnings,'acceptance_hash',v_acceptance_hash,'validated_at',now());
end;
$$;

revoke all on function public.validate_design_acceptance_gate(uuid) from public, anon, authenticated;
grant execute on function public.validate_design_acceptance_gate(uuid) to service_role;

create or replace function public.enforce_project_acceptance_gate() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare dv_id uuid; acceptance text;
begin
  if new.status in ('proposal','approved') then
    select d.active_version_id into dv_id from public.designs d where d.project_id=new.id order by d.updated_at desc nulls last limit 1;
    if dv_id is null then raise exception 'Project cannot enter % status without an active design version',new.status; end if;
    select acceptance_status into acceptance from public.design_versions where id=dv_id;
    if acceptance <> 'valid' then raise exception 'Project cannot enter % status: design version acceptance gate is %',new.status,coalesce(acceptance,'missing'); end if;
  end if; return new;
end; $$;

create or replace function public.enforce_design_acceptance_gate() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare acceptance text;
begin
  if new.status='approved' then
    select acceptance_status into acceptance from public.design_versions where id=new.active_version_id;
    if acceptance <> 'valid' then raise exception 'Design cannot be approved: acceptance gate is %',coalesce(acceptance,'missing'); end if;
  end if; return new;
end; $$;

create or replace function public.enforce_proposal_acceptance_gate() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare acceptance text;
begin
  if new.status is distinct from 'draft' then
    if new.design_version_id is null then raise exception 'Non-draft proposal requires a design version'; end if;
    select acceptance_status into acceptance from public.design_versions where id=new.design_version_id;
    if acceptance <> 'valid' then raise exception 'Proposal cannot leave draft: acceptance gate is %',coalesce(acceptance,'missing'); end if;
  end if; return new;
end; $$;

revoke all on function public.enforce_project_acceptance_gate() from public,anon,authenticated;
revoke all on function public.enforce_design_acceptance_gate() from public,anon,authenticated;
revoke all on function public.enforce_proposal_acceptance_gate() from public,anon,authenticated;
grant execute on function public.enforce_project_acceptance_gate() to service_role;
grant execute on function public.enforce_design_acceptance_gate() to service_role;
grant execute on function public.enforce_proposal_acceptance_gate() to service_role;

drop trigger if exists trg_project_acceptance_gate on public.projects;
create trigger trg_project_acceptance_gate before insert or update of status on public.projects for each row execute function public.enforce_project_acceptance_gate();
drop trigger if exists trg_design_acceptance_gate on public.designs;
create trigger trg_design_acceptance_gate before insert or update of status,active_version_id on public.designs for each row execute function public.enforce_design_acceptance_gate();
drop trigger if exists trg_proposal_acceptance_gate on public.proposals;
create trigger trg_proposal_acceptance_gate before insert or update of status,design_version_id on public.proposals for each row execute function public.enforce_proposal_acceptance_gate();

comment on column public.design_versions.acceptance_status is 'Authoritative end-to-end engineering acceptance state.';
comment on column public.design_versions.acceptance_hash is 'SHA-256 commitment to the exact design/provenance inputs accepted for proposal/approval.';
comment on function public.validate_design_acceptance_gate(uuid) is 'Authoritative P0.8 gate: finalized design + valid geometry + valid electrical topology + completed simulation + valid engineering result + complete provenance.';
