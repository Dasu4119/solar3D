ALTER TABLE public.electrical_strings
  ADD COLUMN IF NOT EXISTS module_voc_v double precision,
  ADD COLUMN IF NOT EXISTS module_vmp_v double precision,
  ADD COLUMN IF NOT EXISTS module_isc_a double precision,
  ADD COLUMN IF NOT EXISTS module_imp_a double precision,
  ADD COLUMN IF NOT EXISTS cold_temp_c double precision DEFAULT -10,
  ADD COLUMN IF NOT EXISTS hot_temp_c double precision DEFAULT 70,
  ADD COLUMN IF NOT EXISTS cold_string_voltage_v double precision,
  ADD COLUMN IF NOT EXISTS hot_string_voltage_v double precision,
  ADD COLUMN IF NOT EXISTS inverter_max_voltage_v double precision,
  ADD COLUMN IF NOT EXISTS inverter_mppt_min_voltage_v double precision,
  ADD COLUMN IF NOT EXISTS inverter_mppt_max_voltage_v double precision,
  ADD COLUMN IF NOT EXISTS inverter_max_current_a double precision,
  ADD COLUMN IF NOT EXISTS electrical_hash text,
  ADD COLUMN IF NOT EXISTS validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS validated_by uuid;

ALTER TABLE public.electrical_strings
  ADD CONSTRAINT electrical_strings_panel_count_positive CHECK (panel_count > 0),
  ADD CONSTRAINT electrical_strings_values_finite CHECK (
    panel_count > 0 AND voltage_v >= 0 AND current_a >= 0 AND power_kw >= 0
    AND (cold_temp_c IS NULL OR cold_temp_c < hot_temp_c)
  );

CREATE OR REPLACE FUNCTION public.validate_electrical_string_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dv record;
  inv record;
  mod record;
  cold_v double precision;
  hot_v double precision;
BEGIN
  SELECT status, geometry_validation_status INTO dv
  FROM public.design_versions WHERE id = NEW.design_version_id;
  IF NOT FOUND OR dv.status <> 'finalized' OR dv.geometry_validation_status <> 'valid' THEN
    RAISE EXCEPTION 'Electrical string requires finalized design version with valid geometry';
  END IF;

  SELECT * INTO inv FROM public.inverters WHERE id = NEW.inverter_id;
  IF NOT FOUND OR COALESCE(inv.active, false) = false THEN
    RAISE EXCEPTION 'Electrical string requires an active inverter';
  END IF;

  SELECT sm.* INTO mod
  FROM public.panel_layouts pl
  JOIN public.solar_modules sm ON sm.id = pl.module_id
  WHERE pl.design_version_id = NEW.design_version_id
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Electrical string requires a solar module linked to the design version';
  END IF;

  IF NEW.panel_count <= 0 THEN RAISE EXCEPTION 'panel_count must be positive'; END IF;
  IF mod.voc_v IS NULL OR mod.vmp_v IS NULL OR mod.isc_a IS NULL OR mod.imp_a IS NULL THEN
    RAISE EXCEPTION 'Solar module electrical ratings are incomplete';
  END IF;

  cold_v := NEW.panel_count * mod.voc_v * (1 + GREATEST(-0.004, LEAST(0, (NEW.cold_temp_c - 25) * -0.003)));
  hot_v := NEW.panel_count * mod.vmp_v * (1 - GREATEST(0, LEAST(0.30, (NEW.hot_temp_c - 25) * 0.003)));

  IF cold_v > inv.max_voltage_v THEN RAISE EXCEPTION 'Cold string voltage exceeds inverter maximum voltage'; END IF;
  IF hot_v < inv.mppt_min_voltage_v OR hot_v > inv.mppt_max_voltage_v THEN
    RAISE EXCEPTION 'Hot string voltage is outside inverter MPPT range';
  END IF;
  IF mod.imp_a > inv.max_current_a THEN RAISE EXCEPTION 'String current exceeds inverter maximum current'; END IF;

  NEW.module_voc_v := mod.voc_v;
  NEW.module_vmp_v := mod.vmp_v;
  NEW.module_isc_a := mod.isc_a;
  NEW.module_imp_a := mod.imp_a;
  NEW.cold_string_voltage_v := cold_v;
  NEW.hot_string_voltage_v := hot_v;
  NEW.inverter_max_voltage_v := inv.max_voltage_v;
  NEW.inverter_mppt_min_voltage_v := inv.mppt_min_voltage_v;
  NEW.inverter_mppt_max_voltage_v := inv.mppt_max_voltage_v;
  NEW.inverter_max_current_a := inv.max_current_a;
  NEW.validation_status := 'valid';
  NEW.validated_at := now();
  NEW.validated_by := auth.uid();
  NEW.electrical_hash := encode(
    digest(
      COALESCE(NEW.design_version_id::text,'') || '|' ||
      COALESCE(NEW.inverter_id::text,'') || '|' ||
      NEW.panel_count::text || '|' ||
      COALESCE(cold_v::text,'') || '|' ||
      COALESCE(hot_v::text,''), 'sha256'
    ), 'hex'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_electrical_string_integrity ON public.electrical_strings;
CREATE TRIGGER trg_validate_electrical_string_integrity
BEFORE INSERT OR UPDATE ON public.electrical_strings
FOR EACH ROW EXECUTE FUNCTION public.validate_electrical_string_integrity();

CREATE UNIQUE INDEX IF NOT EXISTS electrical_strings_design_version_string_number_uq
  ON public.electrical_strings(design_version_id, string_number);

REVOKE INSERT, UPDATE, DELETE ON public.electrical_strings FROM anon, authenticated;
