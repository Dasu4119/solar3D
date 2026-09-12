-- Site-weather simulations must carry enough metadata to reproduce the source observation.
-- Reference and user-supplied simulations remain allowed, but are explicitly distinguished.
-- provenance_class is introduced here as well as guarded by the later hardening migration so
-- this timestamped migration is safe when replayed from a clean database.

ALTER TABLE public.simulation_runs
  ADD COLUMN IF NOT EXISTS provenance_class text NOT NULL DEFAULT 'reference';

ALTER TABLE public.simulation_runs
  DROP CONSTRAINT IF EXISTS simulation_runs_site_weather_source_check;

ALTER TABLE public.simulation_runs
  ADD CONSTRAINT simulation_runs_site_weather_source_check
  CHECK (
    provenance_class <> 'site_weather'
    OR (
      weather_source ? 'provider'
      AND weather_source ? 'source_id'
      AND weather_source ? 'latitude'
      AND weather_source ? 'longitude'
      AND weather_source ? 'period_start'
      AND weather_source ? 'period_end'
      AND weather_source ? 'annual_irradiance_kwh_m2'
      AND jsonb_typeof(weather_source->'latitude') = 'number'
      AND jsonb_typeof(weather_source->'longitude') = 'number'
      AND jsonb_typeof(weather_source->'annual_irradiance_kwh_m2') = 'number'
    )
  );

COMMENT ON CONSTRAINT simulation_runs_site_weather_source_check ON public.simulation_runs IS
  'Site-weather runs require provider, source identity, coordinates, observation period and irradiance metadata.';
