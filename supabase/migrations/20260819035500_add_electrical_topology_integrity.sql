alter table public.electrical_strings add column if not exists mppt_number integer;
alter table public.design_versions add column if not exists electrical_topology_status text not null default 'pending';
alter table public.design_versions add column if not exists electrical_topology_warnings jsonb not null default '[]'::jsonb;
alter table public.design_versions add column if not exists electrical_topology_hash text;
alter table public.design_versions add column if not exists electrical_topology_validated_at timestamptz;
alter table public.design_versions add column if not exists electrical_topology_validated_by uuid references auth.users(id);

alter table public.design_versions drop constraint if exists design_versions_electrical_topology_status_check;
alter table public.design_versions add constraint design_versions_electrical_topology_status_check check (electrical_topology_status = any (array['pending','valid','invalid']));
alter table public.electrical_strings drop constraint if exists electrical_strings_mppt_number_check;
alter table public.electrical_strings add constraint electrical_strings_mppt_number_check check (mppt_number is null or mppt_number > 0);

create unique index if not exists uq_electrical_strings_design_version_string on public.electrical_strings(design_version_id,string_number);
create unique index if not exists uq_panel_placements_layout_panel_index on public.panel_placements(panel_layout_id,panel_index);
create index if not exists idx_panel_placements_layout_string on public.panel_placements(panel_layout_id,string_number);
create index if not exists idx_electrical_strings_inverter on public.electrical_strings(inverter_id);

create or replace function public.validate_electrical_topology(p_design_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_errors jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_total_placements integer := 0;
  v_total_string_panels integer := 0;
  v_total_strings integer := 0;
  v_dc_total numeric := 0;
  v_hash text;
  r record;
begin
  if not exists (select 1 from public.design_versions where id = p_design_version_id) then
    return jsonb_build_object('status','invalid','errors',jsonb_build_array(jsonb_build_object('code','DESIGN_VERSION_NOT_FOUND')),'warnings','[]'::jsonb);
  end if;
  if exists (select 1 from public.panel_placements pp join public.panel_layouts pl on pl.id=pp.panel_layout_id where pl.design_version_id=p_design_version_id and pp.string_number is null) then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object('code','UNASSIGNED_PANEL'));
  end if;
  if exists (select 1 from public.panel_placements pp join public.panel_layouts pl on pl.id=pp.panel_layout_id where pl.design_version_id=p_design_version_id and pp.string_number is not null and pp.string_number <= 0) then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object('code','INVALID_STRING_NUMBER'));
  end if;
  if exists (select 1 from public.panel_placements pp join public.panel_layouts pl on pl.id=pp.panel_layout_id where pl.design_version_id=p_design_version_id and pp.string_number is not null and not exists (select 1 from public.electrical_strings es where es.design_version_id=p_design_version_id and es.string_number=pp.string_number)) then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object('code','STRING_ASSIGNMENT_MISSING'));
  end if;
  for r in select pl.id,pl.panel_count,count(pp.id)::integer placement_count from public.panel_layouts pl left join public.panel_placements pp on pp.panel_layout_id=pl.id where pl.design_version_id=p_design_version_id group by pl.id,pl.panel_count loop
    if r.panel_count <> r.placement_count then v_errors := v_errors || jsonb_build_array(jsonb_build_object('code','LAYOUT_PANEL_COUNT_MISMATCH','layout_id',r.id,'declared',r.panel_count,'placements',r.placement_count)); end if;
  end loop;
  for r in select es.id,es.string_number,es.panel_count,es.inverter_id,es.mppt_number,count(pp.id)::integer placement_count from public.electrical_strings es left join public.panel_layouts pl on pl.design_version_id=es.design_version_id left join public.panel_placements pp on pp.panel_layout_id=pl.id and pp.string_number=es.string_number where es.design_version_id=p_design_version_id group by es.id,es.string_number,es.panel_count,es.inverter_id,es.mppt_number loop
    v_total_strings := v_total_strings + 1; v_total_string_panels := v_total_string_panels + r.panel_count;
    if r.inverter_id is null then v_errors := v_errors || jsonb_build_array(jsonb_build_object('code','STRING_INVERTER_MISSING','string_number',r.string_number)); end if;
    if r.panel_count <> r.placement_count then v_errors := v_errors || jsonb_build_array(jsonb_build_object('code','STRING_PANEL_COUNT_MISMATCH','string_number',r.string_number,'declared',r.panel_count,'placements',r.placement_count)); end if;
    if r.mppt_number is not null and exists (select 1 from public.inverters i where i.id=r.inverter_id and i.mppt_count is not null and r.mppt_number > i.mppt_count) then v_errors := v_errors || jsonb_build_array(jsonb_build_object('code','MPPT_OUT_OF_RANGE','string_number',r.string_number,'mppt_number',r.mppt_number)); end if;
  end loop;
  select count(*)::integer into v_total_placements from public.panel_placements pp join public.panel_layouts pl on pl.id=pp.panel_layout_id where pl.design_version_id=p_design_version_id;
  if v_total_strings > 0 and v_total_string_panels <> v_total_placements then v_errors := v_errors || jsonb_build_array(jsonb_build_object('code','TOPOLOGY_PANEL_TOTAL_MISMATCH','string_panels',v_total_string_panels,'placements',v_total_placements)); end if;
  if v_total_placements > 0 and v_total_strings = 0 then v_errors := v_errors || jsonb_build_array(jsonb_build_object('code','NO_ELECTRICAL_STRINGS')); end if;
  for r in select es.inverter_id,sum(es.power_kw) dc_kw,max(i.max_dc_power_kw) max_dc_kw,max(i.rated_power_kw) ac_kw from public.electrical_strings es join public.inverters i on i.id=es.inverter_id where es.design_version_id=p_design_version_id group by es.inverter_id loop
    v_dc_total := v_dc_total + coalesce(r.dc_kw,0);
    if r.max_dc_kw is not null and r.dc_kw > r.max_dc_kw + 1e-9 then v_errors := v_errors || jsonb_build_array(jsonb_build_object('code','INVERTER_DC_LIMIT_EXCEEDED','inverter_id',r.inverter_id)); end if;
    if r.ac_kw is not null and r.ac_kw > 0 and r.dc_kw/r.ac_kw > 1.5 then v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','HIGH_DC_AC_RATIO','inverter_id',r.inverter_id,'ratio',round((r.dc_kw/r.ac_kw)::numeric,4))); elsif r.ac_kw is not null and r.ac_kw > 0 and r.dc_kw/r.ac_kw < 0.8 then v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','LOW_DC_AC_RATIO','inverter_id',r.inverter_id,'ratio',round((r.dc_kw/r.ac_kw)::numeric,4))); end if;
  end loop;
  select md5(coalesce(jsonb_agg(x order by x.string_number)::text,'[]')) into v_hash from (select es.string_number,es.inverter_id,es.mppt_number,es.panel_count,es.voltage_v,es.current_a,es.power_kw,coalesce(jsonb_agg(pp.panel_index order by pp.panel_index) filter (where pp.id is not null),'[]'::jsonb) panels from public.electrical_strings es left join public.panel_layouts pl on pl.design_version_id=es.design_version_id left join public.panel_placements pp on pp.panel_layout_id=pl.id and pp.string_number=es.string_number where es.design_version_id=p_design_version_id group by es.string_number,es.inverter_id,es.mppt_number,es.panel_count,es.voltage_v,es.current_a,es.power_kw) x;
  update public.electrical_strings set validation_status=case when jsonb_array_length(v_errors)=0 then 'valid' else 'invalid' end,warnings=v_warnings,electrical_hash=v_hash,validated_at=now(),validated_by=null where design_version_id=p_design_version_id;
  update public.design_versions set electrical_topology_status=case when jsonb_array_length(v_errors)=0 then 'valid' else 'invalid' end,electrical_topology_warnings=v_warnings||v_errors,electrical_topology_hash=v_hash,electrical_topology_validated_at=now(),electrical_topology_validated_by=null where id=p_design_version_id;
  return jsonb_build_object('status',case when jsonb_array_length(v_errors)=0 then 'valid' else 'invalid' end,'errors',v_errors,'warnings',v_warnings,'hash',v_hash,'panel_placements',v_total_placements,'string_panels',v_total_string_panels,'strings',v_total_strings,'dc_total_kw',v_dc_total);
end;
$$;
revoke all on function public.validate_electrical_topology(uuid) from public,anon,authenticated;
grant execute on function public.validate_electrical_topology(uuid) to service_role;

create or replace function public.enforce_electrical_topology_finalization() returns trigger language plpgsql set search_path=public,pg_temp as $$ begin if new.status='finalized' and (new.electrical_topology_status <> 'valid' or new.electrical_topology_hash is null) then raise exception 'Cannot finalize design version: electrical topology is not valid'; end if; return new; end; $$;
drop trigger if exists trg_enforce_electrical_topology_finalization on public.design_versions;
create trigger trg_enforce_electrical_topology_finalization before insert or update on public.design_versions for each row execute function public.enforce_electrical_topology_finalization();

create or replace function public.enforce_panel_string_assignment_integrity() returns trigger language plpgsql set search_path=public,pg_temp as $$ declare v_design_version_id uuid; begin select pl.design_version_id into v_design_version_id from public.panel_layouts pl where pl.id=new.panel_layout_id; if new.string_number is not null and not exists (select 1 from public.electrical_strings es where es.design_version_id=v_design_version_id and es.string_number=new.string_number) then raise exception 'Panel placement string_number % has no matching electrical string for design version %',new.string_number,v_design_version_id; end if; return new; end; $$;
drop trigger if exists trg_panel_string_assignment_integrity on public.panel_placements;
create trigger trg_panel_string_assignment_integrity before insert or update on public.panel_placements for each row execute function public.enforce_panel_string_assignment_integrity();
