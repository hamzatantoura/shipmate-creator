
CREATE TABLE IF NOT EXISTS public.courier_pricing_tiers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  courier_id uuid NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  min_weight numeric NOT NULL DEFAULT 0,
  max_weight numeric NOT NULL,
  base_price numeric NOT NULL DEFAULT 0,
  extra_kg_price numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courier_pricing_tiers_courier ON public.courier_pricing_tiers(courier_id);

ALTER TABLE public.courier_pricing_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pricing tiers"
  ON public.courier_pricing_tiers FOR SELECT
  USING (true);

CREATE POLICY "Admins manage pricing tiers"
  ON public.courier_pricing_tiers FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Vendors manage own pricing tiers"
  ON public.courier_pricing_tiers FOR ALL
  USING (has_role(auth.uid(), 'vendor'::app_role) AND is_vendor_courier(courier_id))
  WITH CHECK (has_role(auth.uid(), 'vendor'::app_role) AND is_vendor_courier(courier_id));

-- Validation trigger: range sanity + non-overlap per courier
CREATE OR REPLACE FUNCTION public.validate_courier_pricing_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      AND NEW.min_weight < t.max_weight
      AND NEW.max_weight > t.min_weight
  ) THEN
    RAISE EXCEPTION 'تتداخل شريحة الوزن مع شريحة موجودة لنفس الشركة';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_courier_pricing_tier_trigger ON public.courier_pricing_tiers;
CREATE TRIGGER validate_courier_pricing_tier_trigger
BEFORE INSERT OR UPDATE ON public.courier_pricing_tiers
FOR EACH ROW EXECUTE FUNCTION public.validate_courier_pricing_tier();
