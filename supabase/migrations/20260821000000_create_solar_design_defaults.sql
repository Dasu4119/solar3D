create table if not exists public.solar_design_defaults (
  id boolean primary key default true,
  default_module_id uuid not null references public.solar_modules(id),
  default_roof_geometry jsonb not null,
  setback_north_m double precision not null default 0.3 check (setback_north_m >= 0),
  setback_east_m double precision not null default 0.3 check (setback_east_m >= 0),
  setback_south_m double precision not null default 0.3 check (setback_south_m >= 0),
  setback_west_m double precision not null default 0.3 check (setback_west_m >= 0),
  updated_at timestamptz not null default now(),
  constraint solar_design_defaults_singleton check (id)
);

alter table public.solar_design_defaults enable row level security;

create policy "authenticated users can read solar design defaults"
  on public.solar_design_defaults
  for select
  to authenticated
  using (true);

grant select on public.solar_design_defaults to authenticated;

insert into public.solar_modules (manufacturer, model, technology, power_w, efficiency_percent, length_m, width_m, active)
select 'Solar3D', '400W Reference', 'mono', 400, 20.5, 1.722, 1.134, true
where not exists (
  select 1 from public.solar_modules
  where manufacturer = 'Solar3D' and model = '400W Reference'
);

insert into public.solar_design_defaults (id, default_module_id, default_roof_geometry, setback_north_m, setback_east_m, setback_south_m, setback_west_m)
select true, m.id, '[{"x":0,"y":0},{"x":10,"y":0},{"x":10,"y":6},{"x":0,"y":6}]'::jsonb, 0.3, 0.3, 0.3, 0.3
from public.solar_modules m
where m.manufacturer = 'Solar3D' and m.model = '400W Reference' and m.active = true
on conflict (id) do update set
  default_module_id = excluded.default_module_id,
  default_roof_geometry = excluded.default_roof_geometry,
  setback_north_m = excluded.setback_north_m,
  setback_east_m = excluded.setback_east_m,
  setback_south_m = excluded.setback_south_m,
  setback_west_m = excluded.setback_west_m,
  updated_at = now();