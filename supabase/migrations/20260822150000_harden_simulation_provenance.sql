-- P1 simulation provenance authority.
-- A simulation may only run against the design's finalized active engineering version.
-- Every run captures the immutable design content hash and explicit weather provenance.

ALTER TABLE public.simulation_runs
  ADD COLUMN IF NOT EXISTS design_content_hash text,
  ADD COLUMN IF NOT EXISTS provenance_class text NOT NULL DEFAULT 'reference';

ALTER TABLE public.simulation_runs
  DROP CONSTRAINT IF EXISTS simulation_runs_provenance_class_check;
ALTER TABLE public.simulation_runs
  ADD CONSTRAINT simulation_runs_provenance_class_check
  CHECK (provenance_class IN ('reference','user_supplied','site_weather'));

CREATE INDEX IF NOT EXISTS idx_simulation_runs_provenance_class
  ON public.simulation_runs(provenance_class);

COMMENT ON COLUMN public.simulation_runs.design_content_hash IS
  'Immutable content hash of the design version used by this simulation.';
COMMENT ON COLUMN public.simulation_runs.provenance_class IS
  'Quality class of the weather/site input: reference, user_supplied, or site_weather.';

CREATE OR REPLACE FUNCTION public.validate_simulation_design_version(p_design_version_id uuid)
RETURNS public.design_versions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  dv public.design_versions;
  active_id uuid;
BEGIN
  SELECT * INTO dv
  FROM public.design_versions
  WHERE id = p_design_version_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Design version % not found', p_design_version_id;
  END IF;

  IF dv.status <> 'finalized' THEN
    RAISE EXCEPTION 'Simulation requires a finalized design version';
  END IF;

  SELECT d.active_version_id INTO active_id
  FROM public.designs d
  WHERE d.id = dv.design_id;

  IF active_id IS DISTINCT FROM p_design_version_id THEN
    RAISE EXCEPTION 'Simulation requires the active engineering design version';
  END IF;

  RETURN dv;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_simulation_design_version(uuid)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_simulation_design_version(uuid)
  TO service_role;
