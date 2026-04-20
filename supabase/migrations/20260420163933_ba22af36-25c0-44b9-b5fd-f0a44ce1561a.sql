-- 1) Courier per-district custom rates
CREATE TABLE IF NOT EXISTS public.courier_district_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  district_id uuid NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  custom_delivery_fee numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (courier_id, district_id)
);

CREATE INDEX IF NOT EXISTS idx_courier_district_rates_courier ON public.courier_district_rates(courier_id);
CREATE INDEX IF NOT EXISTS idx_courier_district_rates_district ON public.courier_district_rates(district_id);

ALTER TABLE public.courier_district_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view courier rates"
  ON public.courier_district_rates FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert courier rates"
  ON public.courier_district_rates FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update courier rates"
  ON public.courier_district_rates FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete courier rates"
  ON public.courier_district_rates FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_courier_district_rates_updated_at
  BEFORE UPDATE ON public.courier_district_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Admin management policies on couriers (currently only vendors can manage)
CREATE POLICY "Admins can view all couriers"
  ON public.couriers FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert couriers"
  ON public.couriers FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update couriers"
  ON public.couriers FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete couriers"
  ON public.couriers FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) Allow couriers to be created without a vendor_id (admin-managed shipping companies)
ALTER TABLE public.couriers ALTER COLUMN vendor_id DROP NOT NULL;

-- 4) Allow merchants to view active couriers (so they can pick one when creating an order)
CREATE POLICY "Authenticated can view active couriers"
  ON public.couriers FOR SELECT
  TO authenticated
  USING (is_active = true);
