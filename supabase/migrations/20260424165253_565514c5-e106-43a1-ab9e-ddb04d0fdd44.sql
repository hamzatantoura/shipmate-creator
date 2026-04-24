
-- ============================================================
-- 1. MERCHANTS: Add KYC + store branding fields
-- ============================================================
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS id_front_url text,
  ADD COLUMN IF NOT EXISTS id_back_url text,
  ADD COLUMN IF NOT EXISTS verification_video_url text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS warehouse_address text,
  ADD COLUMN IF NOT EXISTS warehouse_lat numeric,
  ADD COLUMN IF NOT EXISTS warehouse_lng numeric;

-- ============================================================
-- 2. PLATFORM SETTINGS: Single-row global config
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.return_responsibility AS ENUM ('merchant', 'platform', 'carrier');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  default_platform_margin_pct numeric NOT NULL DEFAULT 10,
  return_cost_responsibility public.return_responsibility NOT NULL DEFAULT 'merchant',
  default_return_fee numeric NOT NULL DEFAULT 0,
  default_collection_fee_pct numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_settings_singleton_chk CHECK (singleton = true)
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read platform settings" ON public.platform_settings;
CREATE POLICY "Anyone can read platform settings"
  ON public.platform_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins insert platform settings" ON public.platform_settings;
CREATE POLICY "Admins insert platform settings"
  ON public.platform_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins update platform settings" ON public.platform_settings;
CREATE POLICY "Admins update platform settings"
  ON public.platform_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins delete platform settings" ON public.platform_settings;
CREATE POLICY "Admins delete platform settings"
  ON public.platform_settings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS update_platform_settings_updated_at ON public.platform_settings;
CREATE TRIGGER update_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed exactly one row
INSERT INTO public.platform_settings
  (singleton, default_platform_margin_pct, return_cost_responsibility, default_return_fee, default_collection_fee_pct)
VALUES (true, 10, 'merchant', 0, 1)
ON CONFLICT (singleton) DO NOTHING;

-- ============================================================
-- 3. STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('merchant-kyc', 'merchant-kyc', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('merchant-logos', 'merchant-logos', true)
ON CONFLICT (id) DO NOTHING;

-- KYC bucket policies (private; user folder = auth.uid())
DROP POLICY IF EXISTS "Merchants upload own KYC" ON storage.objects;
CREATE POLICY "Merchants upload own KYC"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'merchant-kyc'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Merchants read own KYC" ON storage.objects;
CREATE POLICY "Merchants read own KYC"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'merchant-kyc'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

DROP POLICY IF EXISTS "Merchants update own KYC" ON storage.objects;
CREATE POLICY "Merchants update own KYC"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'merchant-kyc'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Merchants delete own KYC" ON storage.objects;
CREATE POLICY "Merchants delete own KYC"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'merchant-kyc'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Logos bucket policies (public read)
DROP POLICY IF EXISTS "Public read merchant logos" ON storage.objects;
CREATE POLICY "Public read merchant logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'merchant-logos');

DROP POLICY IF EXISTS "Merchants upload own logo" ON storage.objects;
CREATE POLICY "Merchants upload own logo"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'merchant-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Merchants update own logo" ON storage.objects;
CREATE POLICY "Merchants update own logo"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'merchant-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Merchants delete own logo" ON storage.objects;
CREATE POLICY "Merchants delete own logo"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'merchant-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- 4. REFACTOR WALLET SETTLEMENT TRIGGER
--    Honor dynamic return_cost_responsibility
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_shipment_wallet_settlement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _wallet_id uuid;
  _platform_wallet_id uuid := '00000000-0000-0000-0000-000000000001';
  _cod numeric;
  _carrier_fee numeric;
  _platform_margin numeric;
  _collection_fee numeric;
  _merchant_shipping_fee numeric;
  _net_to_merchant numeric;
  _total_platform_revenue numeric;
  _return_cost numeric;
  _return_resp public.return_responsibility;
  _final_statuses text[] := ARRAY['delivered','returned','cancelled'];
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  IF OLD.status = ANY(_final_statuses) THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('delivered', 'returned') THEN
    RETURN NEW;
  END IF;

  SELECT id INTO _wallet_id FROM public.wallets WHERE merchant_id = NEW.merchant_id LIMIT 1;
  IF _wallet_id IS NULL THEN
    INSERT INTO public.wallets (merchant_id, balance) VALUES (NEW.merchant_id, 0)
    RETURNING id INTO _wallet_id;
  END IF;

  _cod := COALESCE(NEW.cod_amount, 0);
  _carrier_fee := COALESCE(NEW.carrier_fee, 0);
  _platform_margin := COALESCE(NEW.platform_margin, 0);
  _collection_fee := COALESCE(NEW.collection_fee, 0);
  _merchant_shipping_fee := COALESCE(NEW.merchant_shipping_fee, 0);

  -- Read dynamic return responsibility
  SELECT return_cost_responsibility INTO _return_resp
    FROM public.platform_settings LIMIT 1;
  _return_resp := COALESCE(_return_resp, 'merchant'::public.return_responsibility);

  IF NEW.status = 'delivered' THEN
    _net_to_merchant := _cod - _merchant_shipping_fee - _collection_fee;

    BEGIN
      INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, reference_id)
      VALUES (_wallet_id, 'cod_settlement', _cod,
              'تسوية COD - ' || COALESCE(NEW.tracking_number, NEW.id::text), NEW.id);
    EXCEPTION WHEN unique_violation THEN
      RETURN NEW;
    END;

    BEGIN
      INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, reference_id)
      VALUES (_wallet_id, 'shipping_fee', -_merchant_shipping_fee,
              'رسوم شحن - ' || COALESCE(NEW.tracking_number, NEW.id::text), NEW.id);
    EXCEPTION WHEN unique_violation THEN NULL; END;

    IF _collection_fee > 0 THEN
      BEGIN
        INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, reference_id)
        VALUES (_wallet_id, 'commission', -_collection_fee,
                'بدل تحصيل - ' || COALESCE(NEW.tracking_number, NEW.id::text), NEW.id);
      EXCEPTION WHEN unique_violation THEN NULL; END;
    END IF;

    _total_platform_revenue := _platform_margin + _collection_fee;
    BEGIN
      INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, reference_id)
      VALUES (_platform_wallet_id, 'commission', _total_platform_revenue,
              'عمولة منصة - ' || COALESCE(NEW.tracking_number, NEW.id::text), NEW.id);
      UPDATE public.wallets SET balance = balance + _total_platform_revenue, updated_at = now()
        WHERE id = _platform_wallet_id;
    EXCEPTION WHEN unique_violation THEN NULL; END;

    UPDATE public.wallets SET balance = balance + _net_to_merchant, updated_at = now()
      WHERE id = _wallet_id;
  END IF;

  IF NEW.status = 'returned' THEN
    _return_cost := _carrier_fee + _platform_margin;

    -- Only charge merchant if responsibility = 'merchant'
    IF _return_resp = 'merchant' THEN
      BEGIN
        INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, reference_id)
        VALUES (_wallet_id, 'return_fee', -_return_cost,
                'رسوم إرجاع - ' || COALESCE(NEW.tracking_number, NEW.id::text), NEW.id);
      EXCEPTION WHEN unique_violation THEN
        RETURN NEW;
      END;

      UPDATE public.wallets SET balance = balance - _return_cost, updated_at = now()
        WHERE id = _wallet_id;

      BEGIN
        INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, reference_id)
        VALUES (_platform_wallet_id, 'commission', _platform_margin,
                'عمولة مرتجع - ' || COALESCE(NEW.tracking_number, NEW.id::text), NEW.id);
        UPDATE public.wallets SET balance = balance + _platform_margin, updated_at = now()
          WHERE id = _platform_wallet_id;
      EXCEPTION WHEN unique_violation THEN NULL; END;

    ELSIF _return_resp = 'platform' THEN
      -- Platform absorbs the cost; record as expense on platform wallet
      BEGIN
        INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, reference_id)
        VALUES (_platform_wallet_id, 'return_cost', -_return_cost,
                'تكلفة مرتجع (المنصة) - ' || COALESCE(NEW.tracking_number, NEW.id::text), NEW.id);
        UPDATE public.wallets SET balance = balance - _return_cost, updated_at = now()
          WHERE id = _platform_wallet_id;
      EXCEPTION WHEN unique_violation THEN NULL; END;

    END IF;
    -- 'carrier' responsibility: no merchant or platform charge; carrier handles externally
  END IF;

  RETURN NEW;
END;
$function$;
