create table public.simulation_runs (
  id uuid primary key default gen_random_uuid(),
  design_version_id uuid not null references public.design_versions(id) on delete restrict,
  run_number integer not null,
  status text not null default 'completed' check (status = any (array['queued'::text,'running'::text,'completed'::text,'failed'::text,'cancelled'::text])),
  engine_name text not null default 'solar3d-production',
  engine_version text not null,
  input_snapshot jsonb not null default '{}'::jsonb,
  weather_source jsonb not null default '{}'::jsonb,
  assumptions jsonb not null default '{}'::jsonb,
  result_snapshot jsonb not null default '{}'::jsonb,
  input_hash text generated always as (md5(input_snapshot::text)) stored,
  result_hash text generated always as (md5(result_snapshot::text)) stored,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (design_version_id, run_number)
);

create index idx_simulation_runs_version on public.simulation_runs(design_version_id);
create index idx_simulation_runs_created_at on public.simulation_runs(created_at desc);

alter table public.simulation_runs enable row level security;

create policy simulation_runs_select_org_member
on public.simulation_runs
for select
to authenticated
using (
  exists (
    select 1
    from public.design_versions dv
    join public.designs d on d.id = dv.design_id
    join public.projects p on p.id = d.project_id
    where dv.id = simulation_runs.design_version_id
      and public.is_org_member(p.organization_id)
  )
);

create policy simulation_runs_insert_org_member
on public.simulation_runs
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.design_versions dv
    join public.designs d on d.id = dv.design_id
    join public.projects p on p.id = d.project_id
    where dv.id = simulation_runs.design_version_id
      and public.is_org_member(p.organization_id)
  )
);

create or replace function public.prevent_simulation_run_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'simulation_runs are immutable; create a new run instead';
end;
$$;

create trigger simulation_runs_immutable
before update or delete on public.simulation_runs
for each row execute function public.prevent_simulation_run_mutation();

revoke all on public.simulation_runs from anon;
revoke update, delete on public.simulation_runs from authenticated;
