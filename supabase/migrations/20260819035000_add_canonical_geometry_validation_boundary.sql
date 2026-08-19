alter table public.design_versions
  add column if not exists geometry_schema_version integer not null default 1,
  add column if not exists geometry_validation_status text not null default 'pending',
  add column if not exists geometry_validation_errors jsonb not null default '[]'::jsonb,
  add column if not exists geometry_hash text;

alter table public.design_versions
  drop constraint if exists design_versions_geometry_validation_status_check;

alter table public.design_versions
  add constraint design_versions_geometry_validation_status_check
  check (geometry_validation_status = any (array['pending'::text, 'valid'::text, 'invalid'::text]));

alter table public.design_versions
  drop constraint if exists design_versions_finalized_geometry_check;

alter table public.design_versions
  add constraint design_versions_finalized_geometry_check
  check (
    status <> 'finalized'
    or (geometry_validation_status = 'valid' and geometry_hash is not null and jsonb_typeof(geometry) = 'object')
  );

create or replace function public.enforce_design_version_geometry_integrity()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'finalized' then
    if new.geometry_validation_status <> 'valid' then
      raise exception 'design version cannot be finalized until canonical geometry validation passes';
    end if;
    if new.geometry_hash is null then
      raise exception 'design version cannot be finalized without a geometry hash';
    end if;
  end if;

  if new.geometry_validation_status = 'valid' and new.geometry_hash is null then
    raise exception 'valid geometry requires geometry_hash';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_design_version_geometry_integrity on public.design_versions;
create trigger trg_design_version_geometry_integrity
before insert or update on public.design_versions
for each row execute function public.enforce_design_version_geometry_integrity();

comment on column public.design_versions.geometry is 'Canonical engineering geometry snapshot. Renderers must consume this model; they must not become the source of truth.';
comment on column public.design_versions.geometry_validation_status is 'Canonical geometry validation state: pending, valid, or invalid.';
comment on column public.design_versions.geometry_validation_errors is 'Structured canonical geometry validation issues.';
comment on column public.design_versions.geometry_hash is 'Hash of the canonical geometry snapshot used for engineering reproducibility.';
