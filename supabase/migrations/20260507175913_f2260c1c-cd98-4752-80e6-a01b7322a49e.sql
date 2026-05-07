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
  _return_pct numeric;
  _default_return_fee numeric;
  _sale_basis numeric;
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
    _return_pct := NULL;
    IF NEW.courier_id IS NOT NULL THEN
      SELECT return_fee_percentage INTO _return_pct
        FROM public.couriers WHERE id = NEW.courier_id;
    END IF;

    _sale_basis := COALESCE(_cod, 0);

    IF _return_pct IS NOT NULL AND _return_pct > 0 AND _sale_basis > 0 THEN
      _return_cost := round(_sale_basis * _return_pct / 100.0);
    ELSIF _default_return_fee > 0 THEN
      _return_cost := _default_return_fee;
    ELSE
      _return_cost := _carrier_fee + _platform_margin;
    END IF;

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