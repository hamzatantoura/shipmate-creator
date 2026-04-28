-- Update overlap detection: treat ranges as half-open [min, max).
-- Touching edges (e.g. 0-5 and 5-10) are NOT overlap. Real overlap only.
CREATE OR REPLACE FUNCTION public.prevent_courier_rate_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      AND GREATEST(NEW.min_weight_kg, r.min_weight_kg) < LEAST(NEW.max_weight_kg, r.max_weight_kg)
  ) THEN
    RAISE EXCEPTION 'تتداخل شريحة الوزن [%-% كغ] مع شريحة موجودة لنفس المنطقة', NEW.min_weight_kg, NEW.max_weight_kg;
  END IF;

  RETURN NEW;
END;
$function$;
