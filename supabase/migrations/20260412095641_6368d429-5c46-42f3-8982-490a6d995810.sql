
-- Platform admin wallet: use a fixed UUID for the platform
-- We'll use merchant_id = '00000000-0000-0000-0000-000000000001' as platform wallet
INSERT INTO public.wallets (id, merchant_id, balance)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 0)
ON CONFLICT DO NOTHING;

-- Function to handle wallet settlement when shipment status changes
CREATE OR REPLACE FUNCTION public.handle_shipment_wallet_settlement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wallet_id uuid;
  _wallet_balance numeric;
  _platform_wallet_id uuid := '00000000-0000-0000-0000-000000000001';
  _cod numeric;
  _carrier_fee numeric;
  _platform_margin numeric;
  _collection_fee numeric;
  _merchant_shipping_fee numeric;
  _net_to_merchant numeric;
  _total_platform_revenue numeric;
  _return_cost numeric;
BEGIN
  -- Only trigger on status change
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Get merchant wallet
  SELECT id, balance INTO _wallet_id, _wallet_balance
  FROM public.wallets
  WHERE merchant_id = NEW.merchant_id
  LIMIT 1;

  -- If no wallet, create one
  IF _wallet_id IS NULL THEN
    INSERT INTO public.wallets (merchant_id, balance)
    VALUES (NEW.merchant_id, 0)
    RETURNING id, balance INTO _wallet_id, _wallet_balance;
  END IF;

  _cod := COALESCE(NEW.cod_amount, 0);
  _carrier_fee := COALESCE(NEW.carrier_fee, 0);
  _platform_margin := COALESCE(NEW.platform_margin, 0);
  _collection_fee := COALESCE(NEW.collection_fee, 0);
  _merchant_shipping_fee := COALESCE(NEW.merchant_shipping_fee, 0);

  -- ===== DELIVERED =====
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    -- Net to merchant = COD - merchant_shipping_fee - collection_fee
    _net_to_merchant := _cod - _merchant_shipping_fee - _collection_fee;

    -- Credit merchant wallet
    UPDATE public.wallets SET balance = balance + _net_to_merchant, updated_at = now()
    WHERE id = _wallet_id;

    -- Log: COD credit
    INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, reference_id)
    VALUES (_wallet_id, 'cod_settlement', _cod,
            'تسوية COD - ' || COALESCE(NEW.tracking_number, NEW.id::text), NEW.id);

    -- Log: shipping fee debit
    INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, reference_id)
    VALUES (_wallet_id, 'shipping_fee', -_merchant_shipping_fee,
            'رسوم شحن - ' || COALESCE(NEW.tracking_number, NEW.id::text), NEW.id);

    -- Log: collection fee debit
    IF _collection_fee > 0 THEN
      INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, reference_id)
      VALUES (_wallet_id, 'commission', -_collection_fee,
              'بدل تحصيل 1% - ' || COALESCE(NEW.tracking_number, NEW.id::text), NEW.id);
    END IF;

    -- Platform revenue = platform_margin + collection_fee
    _total_platform_revenue := _platform_margin + _collection_fee;
    UPDATE public.wallets SET balance = balance + _total_platform_revenue, updated_at = now()
    WHERE id = _platform_wallet_id;

    INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, reference_id)
    VALUES (_platform_wallet_id, 'commission', _total_platform_revenue,
            'عمولة منصة - ' || COALESCE(NEW.tracking_number, NEW.id::text), NEW.id);
  END IF;

  -- ===== RETURNED =====
  IF NEW.status = 'returned' AND OLD.status != 'returned' THEN
    -- Return cost = carrier_fee + platform_margin (merchant pays full shipping cost)
    _return_cost := _carrier_fee + _platform_margin;

    -- Debit merchant wallet
    UPDATE public.wallets SET balance = balance - _return_cost, updated_at = now()
    WHERE id = _wallet_id;

    -- Log return fee
    INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, reference_id)
    VALUES (_wallet_id, 'return_fee', -_return_cost,
            'رسوم إرجاع - ' || COALESCE(NEW.tracking_number, NEW.id::text), NEW.id);

    -- Platform still earns the margin on returns
    UPDATE public.wallets SET balance = balance + _platform_margin, updated_at = now()
    WHERE id = _platform_wallet_id;

    INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, reference_id)
    VALUES (_platform_wallet_id, 'commission', _platform_margin,
            'عمولة مرتجع - ' || COALESCE(NEW.tracking_number, NEW.id::text), NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_shipment_wallet_settlement ON public.shipments;
CREATE TRIGGER trg_shipment_wallet_settlement
  AFTER UPDATE ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_shipment_wallet_settlement();
