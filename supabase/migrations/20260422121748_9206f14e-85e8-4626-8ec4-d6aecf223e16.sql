-- ============ 1. ALTER couriers ============
ALTER TABLE public.couriers
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS integration_type text NOT NULL DEFAULT 'portal',
  ADD COLUMN IF NOT EXISTS logo_url text;

-- ============ 2. courier_weight_tiers ============
CREATE TABLE IF NOT EXISTS public.courier_weight_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  min_weight numeric NOT NULL DEFAULT 0,
  max_weight numeric NOT NULL DEFAULT 0,
  price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT courier_weight_tiers_range_chk CHECK (max_weight >= min_weight),
  CONSTRAINT courier_weight_tiers_unique UNIQUE (courier_id, min_weight, max_weight)
);
CREATE INDEX IF NOT EXISTS idx_courier_weight_tiers_courier ON public.courier_weight_tiers(courier_id);

ALTER TABLE public.courier_weight_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view weight tiers"
  ON public.courier_weight_tiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon can view weight tiers"
  ON public.courier_weight_tiers FOR SELECT TO anon USING (true);
CREATE POLICY "Admins manage weight tiers - insert"
  ON public.courier_weight_tiers FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage weight tiers - update"
  ON public.courier_weight_tiers FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage weight tiers - delete"
  ON public.courier_weight_tiers FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ 3. courier_coverage_areas ============
CREATE TABLE IF NOT EXISTS public.courier_coverage_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  province_id uuid,
  district_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cca_one_target_chk CHECK (province_id IS NOT NULL OR district_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_cca_courier_province
  ON public.courier_coverage_areas(courier_id, province_id) WHERE province_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_cca_courier_district
  ON public.courier_coverage_areas(courier_id, district_id) WHERE district_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cca_courier ON public.courier_coverage_areas(courier_id);

ALTER TABLE public.courier_coverage_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view coverage areas"
  ON public.courier_coverage_areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon can view coverage areas"
  ON public.courier_coverage_areas FOR SELECT TO anon USING (true);
CREATE POLICY "Admins manage coverage - insert"
  ON public.courier_coverage_areas FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage coverage - update"
  ON public.courier_coverage_areas FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage coverage - delete"
  ON public.courier_coverage_areas FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ 4. field_audit_logs ============
CREATE TABLE IF NOT EXISTS public.field_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_field_audit_record ON public.field_audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_field_audit_created ON public.field_audit_logs(created_at DESC);

ALTER TABLE public.field_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view field audit logs"
  ON public.field_audit_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ 5. Triggers for audit ============
CREATE OR REPLACE FUNCTION public.log_order_price_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.final_sale_price IS DISTINCT FROM OLD.final_sale_price THEN
    INSERT INTO public.field_audit_logs (table_name, record_id, field_name, old_value, new_value, changed_by)
    VALUES ('orders', NEW.id, 'final_sale_price',
            OLD.final_sale_price::text, NEW.final_sale_price::text, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_order_price_change ON public.orders;
CREATE TRIGGER trg_log_order_price_change
  AFTER UPDATE OF final_sale_price ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_price_change();

CREATE OR REPLACE FUNCTION public.log_shipment_weight_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.final_weight IS DISTINCT FROM OLD.final_weight THEN
    INSERT INTO public.field_audit_logs (table_name, record_id, field_name, old_value, new_value, changed_by)
    VALUES ('shipments', NEW.id, 'final_weight',
            OLD.final_weight::text, NEW.final_weight::text, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_shipment_weight_change ON public.shipments;
CREATE TRIGGER trg_log_shipment_weight_change
  AFTER UPDATE OF final_weight ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.log_shipment_weight_change();