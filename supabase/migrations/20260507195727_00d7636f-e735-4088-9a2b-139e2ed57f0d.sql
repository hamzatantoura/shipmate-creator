-- ============================================================
-- Fix wallet settlement: return fee should be % of shipping fee
-- (not % of COD), and split into 2 ledger entries on return.
-- Also backfill historical returned shipments missing entries.
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
  _return_pct numeric;
  _shipping_basis numeric;
  _return_fee numeric;
  _default_return_fee numeric;
  _return_resp public.return_responsibility;
  _final_statuses text[] := ARRAY['delivered','returned','cancelled'];
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  IF OLD.status = ANY(_final_statuses) THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('delivered', 'returned') THEN RETURN NEW; END IF;

  INSERT INTO public.wallets (id, merchant_id, balance, is_platform)
  VALUES (_platform_wallet_id, NULL, 0, true)
  ON CONFLICT (id) DO NOTHING;

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

  SELECT return_cost_responsibility, default_return_fee
    INTO _return_resp, _default_return_fee
    FROM public.platform_settings LIMIT 1;
  _return_resp := COALESCE(_return_resp, 'merchant'::public.return_responsibility);
  _default_return_fee := COALESCE(_default_return_fee, 0);

  IF NEW.status = 'delivered' THEN
    _net_to_merchant := _cod - _merchant_shipping_fee - _collection_fee;

    BEGIN
      INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, reference_id)
      VALUES (_wallet_id, 'cod_settlement', _cod,
              'تحصيل قيمة طلب - ' || COALESCE(NEW.tracking_number, NEW.id::text), NEW.id);
    EXCEPTION WHEN unique_violation THEN RETURN NEW; END;

    BEGIN
      INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, reference_id)
      VALUES (_wallet_id, 'shipping_fee', -_merchant_shipping_fee,
              'أجور شحن - ' || COALESCE(NEW.tracking_number, NEW.id::text), NEW.id);
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
              'إيراد منصة - ' || COALESCE(NEW.tracking_number, NEW.id::text), NEW.id);
      UPDATE public.wallets SET balance = balance + _total_platform_revenue, updated_at = now()
        WHERE id = _platform_wallet_id;
    EXCEPTION WHEN unique_violation THEN NULL; END;

    UPDATE public.wallets SET balance = balance + _net_to_merchant, updated_at = now()
      WHERE id = _wallet_id;
  END IF;

  IF NEW.status = 'returned' THEN
    _return_pct := NULL;
    IF NEW.courier_id IS NOT NULL THEN
      SELECT return_fee_percentage INTO _return_pct FROM public.couriers WHERE id = NEW.courier_id;
    END IF;
    _return_pct := COALESCE(_return_pct, 50);

    -- Basis = the actual shipping fee charged (not COD)
    _shipping_basis := COALESCE(
      NULLIF(_merchant_shipping_fee, 0),
      NULLIF(_carrier_fee, 0),
      NULLIF(_collection_fee, 0),
      0
    );

    _return_fee := round(_shipping_basis * _return_pct / 100.0);
    IF _return_fee = 0 AND _default_return_fee > 0 THEN
      _return_fee := _default_return_fee;
    END IF;

    IF _return_resp = 'merchant' THEN
      -- Entry 1: shipping fee deduction
      IF _shipping_basis > 0 THEN
        BEGIN
          INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, reference_id)
          VALUES (_wallet_id, 'shipping_fee', -_shipping_basis,
                  'أجور شحن (مرتجع) - ' || COALESCE(NEW.tracking_number, NEW.id::text), NEW.id);
          UPDATE public.wallets SET balance = balance - _shipping_basis, updated_at = now()
            WHERE id = _wallet_id;
        EXCEPTION WHEN unique_violation THEN NULL; END;
      END IF;

      -- Entry 2: return fee
      IF _return_fee > 0 THEN
        BEGIN
          INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, reference_id)
          VALUES (_wallet_id, 'return_fee', -_return_fee,
                  'رسوم مرتجع (' || _return_pct || '%) - ' || COALESCE(NEW.tracking_number, NEW.id::text), NEW.id);
          UPDATE public.wallets SET balance = balance - _return_fee, updated_at = now()
            WHERE id = _wallet_id;
        EXCEPTION WHEN unique_violation THEN NULL; END;
      END IF;

      -- Platform records its share (margin + return fee earned)
      BEGIN
        INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, reference_id)
        VALUES (_platform_wallet_id, 'commission', _platform_margin + _return_fee,
                'إيراد منصة (مرتجع) - ' || COALESCE(NEW.tracking_number, NEW.id::text), NEW.id);
        UPDATE public.wallets SET balance = balance + _platform_margin + _return_fee, updated_at = now()
          WHERE id = _platform_wallet_id;
      EXCEPTION WHEN unique_violation THEN NULL; END;

    ELSIF _return_resp = 'platform' THEN
      BEGIN
        INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, reference_id)
        VALUES (_platform_wallet_id, 'return_cost', -(_shipping_basis + _return_fee),
                'تكلفة مرتجع (المنصة) - ' || COALESCE(NEW.tracking_number, NEW.id::text), NEW.id);
        UPDATE public.wallets SET balance = balance - (_shipping_basis + _return_fee), updated_at = now()
          WHERE id = _platform_wallet_id;
      EXCEPTION WHEN unique_violation THEN NULL; END;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- BACKFILL: returned shipments missing correct ledger entries
-- ============================================================
DO $backfill$
DECLARE
  s RECORD;
  _wallet_id uuid;
  _return_pct numeric;
  _shipping_basis numeric;
  _return_fee numeric;
  _existing_shipping numeric;
  _existing_return numeric;
  _delta_shipping numeric;
  _delta_return numeric;
BEGIN
  FOR s IN
    SELECT id, merchant_id, tracking_number, cod_amount, carrier_fee,
           platform_margin, collection_fee, merchant_shipping_fee, courier_id
    FROM public.shipments WHERE status = 'returned'
  LOOP
    SELECT id INTO _wallet_id FROM public.wallets WHERE merchant_id = s.merchant_id LIMIT 1;
    IF _wallet_id IS NULL THEN CONTINUE; END IF;

    _return_pct := NULL;
    IF s.courier_id IS NOT NULL THEN
      SELECT return_fee_percentage INTO _return_pct FROM public.couriers WHERE id = s.courier_id;
    END IF;
    _return_pct := COALESCE(_return_pct, 50);

    _shipping_basis := COALESCE(
      NULLIF(COALESCE(s.merchant_shipping_fee,0),0),
      NULLIF(COALESCE(s.carrier_fee,0),0),
      NULLIF(COALESCE(s.collection_fee,0),0),
      0
    );
    _return_fee := round(_shipping_basis * _return_pct / 100.0);

    -- existing entries for this shipment
    SELECT COALESCE(SUM(-amount),0) INTO _existing_shipping
      FROM public.wallet_transactions
      WHERE reference_id = s.id AND wallet_id = _wallet_id AND type = 'shipping_fee';
    SELECT COALESCE(SUM(-amount),0) INTO _existing_return
      FROM public.wallet_transactions
      WHERE reference_id = s.id AND wallet_id = _wallet_id AND type = 'return_fee';

    _delta_shipping := _shipping_basis - _existing_shipping;
    _delta_return := _return_fee - _existing_return;

    -- Insert missing shipping_fee (only if no existing row at all, since unique idx blocks dupes)
    IF _existing_shipping = 0 AND _shipping_basis > 0 THEN
      BEGIN
        INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, reference_id)
        VALUES (_wallet_id, 'shipping_fee', -_shipping_basis,
                'أجور شحن (مرتجع - تسوية) - ' || COALESCE(s.tracking_number, s.id::text), s.id);
        UPDATE public.wallets SET balance = balance - _shipping_basis, updated_at = now()
          WHERE id = _wallet_id;
      EXCEPTION WHEN unique_violation THEN NULL; END;
    END IF;

    -- Adjust return_fee: there might be an old entry with wrong amount.
    -- Strategy: if existing != target, adjust by delta via a correction entry of type 'carrier_adjustment'
    -- to preserve audit trail (we do NOT delete existing rows).
    IF _existing_return = 0 AND _return_fee > 0 THEN
      BEGIN
        INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, reference_id)
        VALUES (_wallet_id, 'return_fee', -_return_fee,
                'رسوم مرتجع (' || _return_pct || '% - تسوية) - ' || COALESCE(s.tracking_number, s.id::text), s.id);
        UPDATE public.wallets SET balance = balance - _return_fee, updated_at = now()
          WHERE id = _wallet_id;
      EXCEPTION WHEN unique_violation THEN NULL; END;
    ELSIF _existing_return <> _return_fee AND _delta_return <> 0 THEN
      INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, reference_id)
      VALUES (_wallet_id, 'carrier_adjustment', -_delta_return,
              'تصحيح رسوم مرتجع - ' || COALESCE(s.tracking_number, s.id::text), NULL);
      UPDATE public.wallets SET balance = balance - _delta_return, updated_at = now()
        WHERE id = _wallet_id;
    END IF;
  END LOOP;
END;
$backfill$;