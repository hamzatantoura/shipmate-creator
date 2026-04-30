-- 1) Allow platform wallet to exist without merchant_id
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS is_platform boolean NOT NULL DEFAULT false;
ALTER TABLE public.wallets ALTER COLUMN merchant_id DROP NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wallets_merchant_or_platform'
  ) THEN
    ALTER TABLE public.wallets
      ADD CONSTRAINT wallets_merchant_or_platform
      CHECK (is_platform = true OR merchant_id IS NOT NULL);
  END IF;
END $$;

-- Ensure only one platform wallet exists
CREATE UNIQUE INDEX IF NOT EXISTS wallets_single_platform_idx
  ON public.wallets ((true)) WHERE is_platform = true;

-- 2) Seed the canonical platform wallet
INSERT INTO public.wallets (id, merchant_id, balance, is_platform)
VALUES ('00000000-0000-0000-0000-000000000001', NULL, 0, true)
ON CONFLICT (id) DO UPDATE SET is_platform = true;

-- 3) Harden settlement triggers: auto-create wallets defensively
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

  -- Defensive: ensure platform wallet exists
  INSERT INTO public.wallets (id, merchant_id, balance, is_platform)
  VALUES (_platform_wallet_id, NULL, 0, true)
  ON CONFLICT (id) DO NOTHING;

  -- Ensure merchant wallet exists
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
      BEGIN
        INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, reference_id)
        VALUES (_platform_wallet_id, 'return_cost', -_return_cost,
                'تكلفة مرتجع (المنصة) - ' || COALESCE(NEW.tracking_number, NEW.id::text), NEW.id);
        UPDATE public.wallets SET balance = balance - _return_cost, updated_at = now()
          WHERE id = _platform_wallet_id;
      EXCEPTION WHEN unique_violation THEN NULL; END;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4) Same defensive guard for direct order delivered settlement
CREATE OR REPLACE FUNCTION public.handle_order_delivered_settlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _wallet_id uuid;
  _platform_wallet_id uuid := '00000000-0000-0000-0000-000000000001';
  _net numeric;
  _cod numeric;
  _fee numeric;
  _final_statuses text[] := ARRAY['delivered','returned','cancelled'];
  _already_settled boolean;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  IF OLD.status = ANY(_final_statuses) THEN
    RETURN NEW;
  END IF;
  IF NEW.shipment_id IS NOT NULL OR OLD.shipment_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status <> 'delivered' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.wallet_transactions
    WHERE reference_id = NEW.id
      AND type = 'cod_settlement'
  ) INTO _already_settled;
  IF _already_settled THEN
    RETURN NEW;
  END IF;

  _cod := COALESCE(NEW.final_sale_price, NEW.total_amount, 0);
  _fee := COALESCE(NEW.delivery_fee, 0);
  _net := _cod - _fee;

  -- Defensive: ensure platform + merchant wallets exist
  INSERT INTO public.wallets (id, merchant_id, balance, is_platform)
  VALUES (_platform_wallet_id, NULL, 0, true)
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO _wallet_id FROM public.wallets WHERE merchant_id = NEW.merchant_id LIMIT 1;
  IF _wallet_id IS NULL THEN
    INSERT INTO public.wallets (merchant_id, balance) VALUES (NEW.merchant_id, 0)
    RETURNING id INTO _wallet_id;
  END IF;

  BEGIN
    INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, reference_id)
    VALUES (_wallet_id, 'cod_settlement', _net,
            'تسوية طلب مُسلَّم #' || substring(NEW.id::text, 1, 8), NEW.id);
  EXCEPTION WHEN unique_violation THEN
    RETURN NEW;
  END;

  UPDATE public.wallets
    SET balance = balance + _net, updated_at = now()
    WHERE id = _wallet_id;

  RETURN NEW;
END;
$function$;