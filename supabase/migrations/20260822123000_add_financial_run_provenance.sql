create table public.financial_runs (
  id uuid primary key default gen_random_uuid(),
  simulation_run_id uuid not null references public.simulation_runs(id) on delete restrict,
  design_version_id uuid not null references public.design_versions(id) on delete restrict,
  run_number integer not null,
  status text not null default 'completed' check (status = any (array['queued'::text,'running'::text,'completed'::text,'failed'::text,'cancelled'::text])),
  engine_name text not null default 'solar3d-financial',
  engine_version text not null,
  input_snapshot jsonb not null default '{}'::jsonb,
  result_snapshot jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  source_simulation_result_hash text not null,
  input_hash text generated always as (md5(input_snapshot::text)) stored,
  result_hash text generated always as (md5(result_snapshot::text)) stored,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (simulation_run_id, run_number)
);

create index idx_financial_runs_simulation on public.financial_runs(simulation_run_id);
create index idx_financial_runs_version on public.financial_runs(design_version_id);
create index idx_financial_runs_created_at on public.financial_runs(created_at desc);

alter table public.financial_runs enable row level security;

create policy financial_runs_select_org_member
on public.financial_runs
for select
to authenticated
using (
  exists (
    select 1
    from public.design_versions dv
    join public.designs d on d.id = dv.design_id
    join public.projects p on p.id = d.project_id
    where dv.id = financial_runs.design_version_id
      and public.is_org_member(p.organization_id)
  )
);

create policy financial_runs_insert_org_member
on public.financial_runs
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and design_version_id = (
    select sr.design_version_id
    from public.simulation_runs sr
    where sr.id = financial_runs.simulation_run_id
      and sr.status = 'completed'
  )
  and source_simulation_result_hash = (
    select sr.result_hash
    from public.simulation_runs sr
    where sr.id = financial_runs.simulation_run_id
      and sr.status = 'completed'
  )
  and exists (
    select 1
    from public.design_versions dv
    join public.designs d on d.id = dv.design_id
    join public.projects p on p.id = d.project_id
    where dv.id = financial_runs.design_version_id
      and public.is_org_member(p.organization_id)
  )
);

create or replace function public.prevent_financial_run_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'financial_runs are immutable; create a new run instead';
end;
$$;

create trigger financial_runs_immutable
before update or delete on public.financial_runs
for each row execute function public.prevent_financial_run_mutation();

revoke all on public.financial_runs from anon;
revoke update, delete on public.financial_runs from authenticated;
