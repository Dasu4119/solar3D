-- P1 commercial output authority.
-- BOMs and proposals are immutable snapshots tied to the exact financial/design inputs that produced them.

create table public.bom_runs (
  id uuid primary key default gen_random_uuid(),
  financial_run_id uuid not null references public.financial_runs(id) on delete restrict,
  design_version_id uuid not null references public.design_versions(id) on delete restrict,
  run_number integer not null,
  status text not null default 'completed' check (status in ('queued','running','completed','failed','cancelled')),
  engine_name text not null default 'solar3d-bom',
  engine_version text not null,
  input_snapshot jsonb not null default '{}'::jsonb,
  result_snapshot jsonb not null default '{}'::jsonb,
  source_financial_result_hash text not null,
  input_hash text generated always as (md5(input_snapshot::text)) stored,
  result_hash text generated always as (md5(result_snapshot::text)) stored,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (financial_run_id, run_number)
);

create table public.proposal_runs (
  id uuid primary key default gen_random_uuid(),
  bom_run_id uuid not null references public.bom_runs(id) on delete restrict,
  financial_run_id uuid not null references public.financial_runs(id) on delete restrict,
  design_version_id uuid not null references public.design_versions(id) on delete restrict,
  run_number integer not null,
  status text not null default 'completed' check (status in ('queued','running','completed','failed','cancelled')),
  engine_name text not null default 'solar3d-proposal',
  engine_version text not null,
  input_snapshot jsonb not null default '{}'::jsonb,
  result_snapshot jsonb not null default '{}'::jsonb,
  source_bom_result_hash text not null,
  source_financial_result_hash text not null,
  input_hash text generated always as (md5(input_snapshot::text)) stored,
  result_hash text generated always as (md5(result_snapshot::text)) stored,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (bom_run_id, run_number)
);

create index idx_bom_runs_financial on public.bom_runs(financial_run_id);
create index idx_bom_runs_version on public.bom_runs(design_version_id);
create index idx_proposal_runs_bom on public.proposal_runs(bom_run_id);
create index idx_proposal_runs_financial on public.proposal_runs(financial_run_id);
create index idx_proposal_runs_version on public.proposal_runs(design_version_id);

alter table public.bom_runs enable row level security;
alter table public.proposal_runs enable row level security;

create policy bom_runs_select_org_member on public.bom_runs for select to authenticated using (
  exists (select 1 from public.design_versions dv join public.designs d on d.id = dv.design_id join public.projects p on p.id = d.project_id where dv.id = bom_runs.design_version_id and public.is_org_member(p.organization_id))
);

create policy bom_runs_insert_org_member on public.bom_runs for insert to authenticated with check (
  created_by = auth.uid()
  and design_version_id = (select fr.design_version_id from public.financial_runs fr where fr.id = bom_runs.financial_run_id and fr.status = 'completed')
  and source_financial_result_hash = (select fr.result_hash from public.financial_runs fr where fr.id = bom_runs.financial_run_id and fr.status = 'completed')
  and exists (select 1 from public.design_versions dv join public.designs d on d.id = dv.design_id join public.projects p on p.id = d.project_id where dv.id = bom_runs.design_version_id and dv.status = 'finalized' and public.is_org_member(p.organization_id))
);

create policy proposal_runs_select_org_member on public.proposal_runs for select to authenticated using (
  exists (select 1 from public.design_versions dv join public.designs d on d.id = dv.design_id join public.projects p on p.id = d.project_id where dv.id = proposal_runs.design_version_id and public.is_org_member(p.organization_id))
);

create policy proposal_runs_insert_org_member on public.proposal_runs for insert to authenticated with check (
  created_by = auth.uid()
  and design_version_id = (select br.design_version_id from public.bom_runs br where br.id = proposal_runs.bom_run_id and br.status = 'completed')
  and financial_run_id = (select br.financial_run_id from public.bom_runs br where br.id = proposal_runs.bom_run_id and br.status = 'completed')
  and source_bom_result_hash = (select br.result_hash from public.bom_runs br where br.id = proposal_runs.bom_run_id and br.status = 'completed')
  and source_financial_result_hash = (select fr.result_hash from public.financial_runs fr where fr.id = proposal_runs.financial_run_id and fr.status = 'completed')
  and exists (select 1 from public.design_versions dv join public.designs d on d.id = dv.design_id join public.projects p on p.id = d.project_id where dv.id = proposal_runs.design_version_id and dv.status = 'finalized' and public.is_org_member(p.organization_id))
);

create or replace function public.prevent_commercial_output_mutation()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  raise exception 'commercial output snapshots are immutable; create a new run instead';
end;
$$;

create trigger bom_runs_immutable before update or delete on public.bom_runs for each row execute function public.prevent_commercial_output_mutation();
create trigger proposal_runs_immutable before update or delete on public.proposal_runs for each row execute function public.prevent_commercial_output_mutation();

revoke all on public.bom_runs from anon;
revoke all on public.proposal_runs from anon;
revoke update, delete on public.bom_runs from authenticated;
revoke update, delete on public.proposal_runs from authenticated;
