create table if not exists public.ci_e2e_diagnostics (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  stage text not null,
  message text not null
);

alter table public.ci_e2e_diagnostics enable row level security;
revoke all on public.ci_e2e_diagnostics from anon, authenticated;
grant select, insert, delete on public.ci_e2e_diagnostics to service_role;
