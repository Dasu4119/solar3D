ALTER TABLE public.design_versions
  ADD COLUMN IF NOT EXISTS geometry_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS geometry_validated_by uuid REFERENCES auth.users(id);

CREATE OR REPLACE FUNCTION public.enforce_design_version_validation_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'finalized' THEN
    IF NEW.geometry_schema_version <> 1
       OR NEW.geometry_validation_status <> 'valid'
       OR NEW.geometry_hash IS NULL
       OR NEW.geometry_validated_at IS NULL
       OR NEW.geometry_validated_by IS NULL THEN
      RAISE EXCEPTION 'Design version cannot be finalized until persisted geometry validation passes.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS design_versions_validation_gate ON public.design_versions;
CREATE TRIGGER design_versions_validation_gate
BEFORE INSERT OR UPDATE ON public.design_versions
FOR EACH ROW EXECUTE FUNCTION public.enforce_design_version_validation_gate();
