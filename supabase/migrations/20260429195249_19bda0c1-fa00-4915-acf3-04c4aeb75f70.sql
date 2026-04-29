-- ============================================================
-- STEP 8: Fix double wallet settlement & lock merchant status
-- ============================================================

-- ------------------------------------------------------------
-- 1) Remove duplicate triggers (same function attached twice)
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_order_delivered_settlement ON public.orders;
DROP TRIGGER IF EXISTS trg_shipment_wallet_settlement ON public.shipments;
-- Keep: trg_handle_order_delivered_settlement, trg_handle_shipment_wallet_settlement

-- ------------------------------------------------------------
-- 2) Harden order-level settlement: never settle if the order
--    is (or ever was) tied to a shipment — the shipment trigger
--    is the authoritative settlement path in that case.
--    Also belt-and-suspenders: skip if a cod_settlement tx for
--    this order already exists.
-- ------------------------------------------------------------
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
  _already_settled boolean;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  IF OLD.status = ANY(_final_statuses) THEN
    RETURN NEW;
  END IF;
  -- Authoritative path for shipment-backed orders is the shipment trigger
  IF NEW.shipment_id IS NOT NULL OR OLD.shipment_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status <> 'delivered' THEN
    RETURN NEW;
  END IF;

  -- Defensive: skip if COD already credited for this order under any wallet
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

-- ------------------------------------------------------------
-- 3) Block merchants from spoofing terminal statuses on orders
--    Allowed transitions for a merchant: 'new' -> 'cancelled' (own cancellation),
--    plus operational statuses driven by the system. Sensitive targets
--    (delivered / returned / shipped / out_for_delivery / processing)
--    must come from courier (vendor), admin, or the shipment-sync trigger.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_merchant_status_spoof()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _restricted text[] := ARRAY[
    'delivered',
    'returned',
    'shipped',
    'out_for_delivery',
    'processing'
  ];
  _is_admin boolean;
  _is_vendor boolean;
BEGIN
  -- Only inspect status changes
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- System / SECURITY DEFINER context (e.g. shipment sync trigger): no auth.uid().
  -- Allow it through — the source trigger already validated the actor.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  _is_admin  := public.has_role(auth.uid(), 'admin'::app_role);
  _is_vendor := public.has_role(auth.uid(), 'vendor'::app_role);

  IF _is_admin OR _is_vendor THEN
    RETURN NEW;
  END IF;

  -- At this point the actor is a merchant (or any non-privileged role).
  IF NEW.status = ANY(_restricted) THEN
    RAISE EXCEPTION 'لا يمكن للتاجر تعديل حالة الطلب إلى "%"؛ يتم ذلك تلقائياً عبر شركة الشحن.', NEW.status
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_merchant_status_spoof ON public.orders;
CREATE TRIGGER trg_prevent_merchant_status_spoof
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.prevent_merchant_status_spoof();