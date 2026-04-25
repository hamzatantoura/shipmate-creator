
-- ============================================
-- PHASE 1: COURIER LOGOS BUCKET
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('courier-logos', 'courier-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read courier logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'courier-logos');

CREATE POLICY "Admins upload courier logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'courier-logos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update courier logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'courier-logos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete courier logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'courier-logos' AND has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- PHASE 2: BACKFILL EXISTING COURIERS WITH SANE DEFAULTS
-- (before adding constraints that might fail)
-- ============================================
UPDATE public.couriers
SET cod_fee_value = 1.0,        -- 1% default COD fee
    cod_fee_type = 'percentage',
    services = ARRAY['standard']::text[]
WHERE cod_fee_value = 0;

-- Detach "كرم للشحن" courier owned by admin (per user's choice: delete it)
DELETE FROM public.couriers
WHERE vendor_id = 'd47666f3-542d-4c48-a76f-aeae1e421edb';

-- ============================================
-- PHASE 3: UNIQUE CONSTRAINTS ON COURIERS
-- ============================================
-- One vendor account = one courier company
ALTER TABLE public.couriers
  DROP CONSTRAINT IF EXISTS couriers_vendor_id_unique;
ALTER TABLE public.couriers
  ADD CONSTRAINT couriers_vendor_id_unique UNIQUE (vendor_id);

-- Unique courier name (case-insensitive)
DROP INDEX IF EXISTS couriers_name_unique_idx;
CREATE UNIQUE INDEX couriers_name_unique_idx ON public.couriers (LOWER(name));

-- Validate cod_fee_type
ALTER TABLE public.couriers
  DROP CONSTRAINT IF EXISTS couriers_cod_fee_type_chk;
ALTER TABLE public.couriers
  ADD CONSTRAINT couriers_cod_fee_type_chk
  CHECK (cod_fee_type IN ('percentage','fixed'));

-- ============================================
-- PHASE 4: PRICING VALIDATION
-- ============================================
ALTER TABLE public.courier_district_rates
  DROP CONSTRAINT IF EXISTS courier_district_rates_fee_nonneg;
ALTER TABLE public.courier_district_rates
  ADD CONSTRAINT courier_district_rates_fee_nonneg
  CHECK (custom_delivery_fee >= 0);

-- Unique rate per courier+district
DROP INDEX IF EXISTS courier_district_rates_unique_idx;
CREATE UNIQUE INDEX courier_district_rates_unique_idx
  ON public.courier_district_rates (courier_id, district_id);

-- ============================================
-- PHASE 5: COURIER WALLET CREDIT TRIGGER
-- Credits courier wallet when shipment delivered/returned
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_courier_wallet_credit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _carrier_fee numeric;
  _final_statuses text[] := ARRAY['delivered','returned','cancelled'];
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  IF OLD.status = ANY(_final_statuses) THEN
    RETURN NEW;
  END IF;
  IF NEW.courier_id IS NULL THEN
    RETURN NEW;
  END IF;

  _carrier_fee := COALESCE(NEW.carrier_fee, 0);
  IF _carrier_fee <= 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'delivered' THEN
    UPDATE public.couriers
      SET wallet_balance = wallet_balance + _carrier_fee
      WHERE id = NEW.courier_id;
  ELSIF NEW.status = 'returned' THEN
    -- Half fee on return (return pickup work done)
    UPDATE public.couriers
      SET wallet_balance = wallet_balance + (_carrier_fee * 0.5)
      WHERE id = NEW.courier_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_courier_wallet_credit ON public.shipments;
CREATE TRIGGER trg_courier_wallet_credit
AFTER UPDATE ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.handle_courier_wallet_credit();

-- ============================================
-- PHASE 6: DROP LEGACY TABLES
-- ============================================
DROP TABLE IF EXISTS public.shipping_zones CASCADE;
DROP TABLE IF EXISTS public.carrier_coverage CASCADE;
DROP TABLE IF EXISTS public.courier_weight_tiers CASCADE;
DROP TABLE IF EXISTS public.courier_coverage_areas CASCADE;

-- carriers table is still referenced by shipments.carrier_id; keep it but mark inactive
-- Actually shipments.carrier_id is a soft FK with no constraint -> safe to drop
ALTER TABLE public.shipments DROP COLUMN IF EXISTS carrier_id;
DROP TABLE IF EXISTS public.carriers CASCADE;
