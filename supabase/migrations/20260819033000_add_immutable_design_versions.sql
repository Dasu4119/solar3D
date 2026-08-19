ALTER TABLE public.design_versions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';
ALTER TABLE public.design_versions ADD COLUMN IF NOT EXISTS finalized_at timestamptz;
ALTER TABLE public.design_versions ADD COLUMN IF NOT EXISTS finalized_by uuid REFERENCES auth.users(id);
ALTER TABLE public.design_versions ADD COLUMN IF NOT EXISTS content_hash text;
ALTER TABLE public.design_versions DROP CONSTRAINT IF EXISTS design_versions_status_check;
ALTER TABLE public.design_versions ADD CONSTRAINT design_versions_status_check CHECK (status IN ('draft','finalized','superseded','archived'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_design_versions_design_version_number ON public.design_versions(design_id, version_number);
CREATE OR REPLACE FUNCTION public.design_version_content_hash(p public.design_versions) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT md5(concat_ws('|', p.design_id::text, p.version_number::text, coalesce(p.name,''), coalesce(p.change_summary,''), p.geometry::text, p.metrics::text)); $$;
UPDATE public.design_versions SET content_hash = public.design_version_content_hash(design_versions) WHERE content_hash IS NULL;
CREATE OR REPLACE FUNCTION public.validate_design_version_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('finalized','superseded','archived') THEN
      RAISE EXCEPTION 'design_versions are immutable after finalization; create a new version instead';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status IN ('finalized','superseded','archived') THEN
    IF NEW.design_id IS DISTINCT FROM OLD.design_id OR NEW.version_number IS DISTINCT FROM OLD.version_number OR NEW.name IS DISTINCT FROM OLD.name OR NEW.change_summary IS DISTINCT FROM OLD.change_summary OR NEW.geometry IS DISTINCT FROM OLD.geometry OR NEW.metrics IS DISTINCT FROM OLD.metrics OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.content_hash IS DISTINCT FROM OLD.content_hash THEN
      RAISE EXCEPTION 'design_versions are immutable after finalization; create a new version instead';
    END IF;
    IF OLD.status = 'finalized' AND NEW.status NOT IN ('finalized','superseded') THEN
      RAISE EXCEPTION 'finalized design versions may only remain finalized or become superseded';
    END IF;
    IF OLD.status IN ('superseded','archived') AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'superseded or archived design versions cannot change state';
    END IF;
  END IF;
  IF NEW.status IN ('finalized','superseded','archived') AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.finalized_at := COALESCE(OLD.finalized_at, now());
    NEW.finalized_by := COALESCE(OLD.finalized_by, auth.uid());
  END IF;
  NEW.content_hash := public.design_version_content_hash(NEW);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_design_version_state ON public.design_versions;
CREATE TRIGGER trg_design_version_state BEFORE INSERT OR UPDATE OR DELETE ON public.design_versions FOR EACH ROW EXECUTE FUNCTION public.validate_design_version_state();
ALTER TABLE public.design_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS design_versions_select_org ON public.design_versions;
CREATE POLICY design_versions_select_org ON public.design_versions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.designs d JOIN public.projects p ON p.id = d.project_id WHERE d.id = design_versions.design_id AND public.is_org_member(p.organization_id)));
DROP POLICY IF EXISTS design_versions_insert_org ON public.design_versions;
CREATE POLICY design_versions_insert_org ON public.design_versions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.designs d JOIN public.projects p ON p.id = d.project_id WHERE d.id = design_versions.design_id AND public.is_org_member(p.organization_id)));
DROP POLICY IF EXISTS design_versions_update_org ON public.design_versions;
CREATE POLICY design_versions_update_org ON public.design_versions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.designs d JOIN public.projects p ON p.id = d.project_id WHERE d.id = design_versions.design_id AND public.is_org_member(p.organization_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.designs d JOIN public.projects p ON p.id = d.project_id WHERE d.id = design_versions.design_id AND public.is_org_member(p.organization_id)));
DROP POLICY IF EXISTS design_versions_delete_org ON public.design_versions;
CREATE POLICY design_versions_delete_org ON public.design_versions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.designs d JOIN public.projects p ON p.id = d.project_id WHERE d.id = design_versions.design_id AND public.is_org_member(p.organization_id)));
