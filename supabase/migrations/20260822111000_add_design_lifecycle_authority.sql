-- Solar3D P0 design lifecycle authority.
-- A design may have one working draft and one active engineering version.
-- Layout selection is explicit; directional setbacks are persisted without loss.

ALTER TABLE public.designs
  ADD COLUMN IF NOT EXISTS draft_version_id uuid REFERENCES public.design_versions(id);

ALTER TABLE public.design_versions
  ADD COLUMN IF NOT EXISTS active_layout_id uuid;

ALTER TABLE public.panel_layouts
  ADD COLUMN IF NOT EXISTS setback_north_m numeric,
  ADD COLUMN IF NOT EXISTS setback_east_m numeric,
  ADD COLUMN IF NOT EXISTS setback_south_m numeric,
  ADD COLUMN IF NOT EXISTS setback_west_m numeric;

-- Backfill directional setbacks from the legacy scalar value.
UPDATE public.panel_layouts
SET
  setback_north_m = COALESCE(setback_north_m, setback_m),
  setback_east_m = COALESCE(setback_east_m, setback_m),
  setback_south_m = COALESCE(setback_south_m, setback_m),
  setback_west_m = COALESCE(setback_west_m, setback_m)
WHERE setback_m IS NOT NULL;

ALTER TABLE public.design_versions
  DROP CONSTRAINT IF EXISTS design_versions_active_layout_fk;
ALTER TABLE public.design_versions
  ADD CONSTRAINT design_versions_active_layout_fk
  FOREIGN KEY (active_layout_id) REFERENCES public.panel_layouts(id) ON DELETE SET NULL;

-- Keep the working draft separate from the active engineering version.
CREATE INDEX IF NOT EXISTS idx_designs_draft_version_id ON public.designs(draft_version_id);
CREATE INDEX IF NOT EXISTS idx_design_versions_active_layout_id ON public.design_versions(active_layout_id);

-- A draft pointer must belong to the same design.
CREATE OR REPLACE FUNCTION public.validate_design_draft_pointer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.draft_version_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.design_versions dv
      WHERE dv.id = NEW.draft_version_id
        AND dv.design_id = NEW.id
        AND dv.status = 'draft'
    ) THEN
      RAISE EXCEPTION 'draft_version_id must reference a draft version belonging to the design';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_design_draft_pointer ON public.designs;
CREATE TRIGGER trg_design_draft_pointer
BEFORE INSERT OR UPDATE OF draft_version_id ON public.designs
FOR EACH ROW EXECUTE FUNCTION public.validate_design_draft_pointer();

-- An active layout must belong to the selected design version.
CREATE OR REPLACE FUNCTION public.validate_design_active_layout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.active_layout_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.panel_layouts pl
      WHERE pl.id = NEW.active_layout_id
        AND pl.design_version_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'active_layout_id must reference a layout belonging to the design version';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_design_version_active_layout ON public.design_versions;
CREATE TRIGGER trg_design_version_active_layout
BEFORE INSERT OR UPDATE OF active_layout_id ON public.design_versions
FOR EACH ROW EXECUTE FUNCTION public.validate_design_active_layout();

COMMENT ON COLUMN public.designs.draft_version_id IS 'Current mutable working version. Never used as the engineering-approved version.';
COMMENT ON COLUMN public.design_versions.active_layout_id IS 'Explicit layout selected for this design version; array ordering is not authoritative.';
COMMENT ON COLUMN public.panel_layouts.setback_north_m IS 'Canonical north setback used to generate this layout.';
COMMENT ON COLUMN public.panel_layouts.setback_east_m IS 'Canonical east setback used to generate this layout.';
COMMENT ON COLUMN public.panel_layouts.setback_south_m IS 'Canonical south setback used to generate this layout.';
COMMENT ON COLUMN public.panel_layouts.setback_west_m IS 'Canonical west setback used to generate this layout.';
