-- Fix overlap detection: half-open ranges [min, max). Touching edges are NOT overlap.

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

CREATE OR REPLACE FUNCTION public.validate_courier_pricing_tier()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.min_weight IS NULL OR NEW.max_weight IS NULL THEN
    RAISE EXCEPTION 'يجب تحديد الحد الأدنى والأقصى للوزن';
  END IF;
  IF NEW.min_weight < 0 OR NEW.max_weight <= NEW.min_weight THEN
    RAISE EXCEPTION 'نطاق الوزن غير صالح: يجب أن يكون الحد الأقصى أكبر من الحد الأدنى';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.courier_pricing_tiers t
    WHERE t.courier_id = NEW.courier_id
      AND t.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND GREATEST(NEW.min_weight, t.min_weight) < LEAST(NEW.max_weight, t.max_weight)
  ) THEN
    RAISE EXCEPTION 'تتداخل شريحة الوزن [%-% كغ] مع شريحة موجودة لنفس الشركة', NEW.min_weight, NEW.max_weight;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;