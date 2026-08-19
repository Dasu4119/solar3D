create unique index if not exists simulation_runs_design_version_run_number_key
  on public.simulation_runs (design_version_id, run_number);
