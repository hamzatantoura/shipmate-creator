-- 1) Drop the legacy single-row-per-district uniques
ALTER TABLE public.courier_district_rates
  DROP CONSTRAINT IF EXISTS courier_district_rates_courier_id_district_id_key;

DROP INDEX IF EXISTS public.courier_district_rates_unique_idx;

-- 2) New smart unique: one tier per (courier, district, min_weight)
CREATE UNIQUE INDEX IF NOT EXISTS courier_district_rates_tier_unique_idx
  ON public.courier_district_rates (courier_id, district_id, min_weight_kg);

-- 3) Server-side overlap guard
CREATE OR REPLACE FUNCTION public.prevent_courier_rate_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.min_weight_kg IS NULL OR NEW.max_weight_kg IS NULL THEN
    RAISE EXCEPTION 'يجب تحديد الحد الأدنى والأقصى للوزن';
  END IF;

  IF NEW.min_weight_kg < 0 OR NEW.max_weight_kg <= NEW.min_weight_kg THEN
    RAISE EXCEPTION 'نطاق الوزن غير صالح: يجب أن يكون الحد الأقصى أكبر من الحد الأدنى';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.courier_district_rates r
    WHERE r.courier_id = NEW.courier_id
      AND r.district_id = NEW.district_id
      AND r.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND NEW.min_weight_kg < r.max_weight_kg
      AND NEW.max_weight_kg > r.min_weight_kg
  ) THEN
    RAISE EXCEPTION 'تتداخل شريحة الوزن مع شريحة موجودة لنفس المنطقة';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_courier_rate_overlap ON public.courier_district_rates;
CREATE TRIGGER trg_prevent_courier_rate_overlap
  BEFORE INSERT OR UPDATE ON public.courier_district_rates
  FOR EACH ROW EXECUTE FUNCTION public.prevent_courier_rate_overlap();