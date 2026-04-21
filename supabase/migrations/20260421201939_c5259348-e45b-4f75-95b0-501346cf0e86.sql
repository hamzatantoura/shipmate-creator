
-- =================================================================
-- PHASE 2A: BULLETPROOF FINANCIAL SETTLEMENT (with cleanup)
-- =================================================================

-- 0) DEDUPE: keep the OLDEST row per (reference_id, type), reverse the
--    duplicates' net effect on wallet balances, then delete them.
WITH ranked AS (
  SELECT id, wallet_id, amount,
         row_number() OVER (PARTITION BY reference_id, type ORDER BY created_at, id) AS rn
  FROM public.wallet_transactions
  WHERE reference_id IS NOT NULL
),
dupes AS (
  SELECT id, wallet_id, amount FROM ranked WHERE rn > 1
),
balance_reversal AS (
  SELECT wallet_id, SUM(amount) AS dup_total
  FROM dupes
  GROUP BY wallet_id
)
UPDATE public.wallets w
SET balance = balance - br.dup_total,
    updated_at = now()
FROM balance_reversal br
WHERE w.id = br.wallet_id;

DELETE FROM public.wallet_transactions
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           row_number() OVER (PARTITION BY reference_id, type ORDER BY created_at, id) AS rn
    FROM public.wallet_transactions
    WHERE reference_id IS NOT NULL
  ) x WHERE rn > 1
);

-- 1) Hard idempotency on the ledger
CREATE UNIQUE INDEX IF NOT EXISTS uniq_wallet_tx_reference_type
  ON public.wallet_transactions (reference_id, type)
  WHERE reference_id IS NOT NULL;

-- 2) Reset the orders-side trigger
DROP TRIGGER IF EXISTS trg_handle_order_delivered_settlement ON public.orders;
DROP TRIGGER IF EXISTS handle_order_delivered_settlement ON public.orders;
DROP TRIGGER IF EXISTS order_delivered_settlement ON public.orders;
DROP TRIGGER IF EXISTS orders_delivered_settlement ON public.orders;

CREATE OR REPLACE FUNCTION public.handle_order_delivered_settlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _wallet_id uuid;
  _net numeric;
  _cod numeric;
  _fee numeric;
  _final_statuses text[] := ARRAY['delivered','returned','cancelled'];
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  IF OLD.status = ANY(_final_statuses) THEN
    RETURN NEW;
  END IF;
  IF NEW.shipment_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status <> 'delivered' THEN
    RETURN NEW;
  END IF;

  _cod := COALESCE(NEW.final_sale_price, NEW.total_amount, 0);
  _fee := COALESCE(NEW.delivery_fee, 0);
  _net := _cod - _fee;

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

CREATE TRIGGER trg_handle_order_delivered_settlement
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_delivered_settlement();

-- 3) Reset the shipments-side trigger
DROP TRIGGER IF EXISTS trg_handle_shipment_wallet_settlement ON public.shipments;
DROP TRIGGER IF EXISTS handle_shipment_wallet_settlement ON public.shipments;
DROP TRIGGER IF EXISTS shipment_wallet_settlement ON public.shipments;
DROP TRIGGER IF EXISTS shipments_wallet_settlement ON public.shipments;

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
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_handle_shipment_wallet_settlement
  AFTER UPDATE OF status ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_shipment_wallet_settlement();
