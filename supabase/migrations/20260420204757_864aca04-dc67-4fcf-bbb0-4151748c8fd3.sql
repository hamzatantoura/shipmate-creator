-- 1) return_reason on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS return_reason text;

-- 2) Trigger: when an order's status moves to 'delivered' and there's NO shipment
--    (so the existing shipment-settlement trigger won't run), credit the merchant
--    wallet ledger with the net amount (cod - delivery_fee).
CREATE OR REPLACE FUNCTION public.handle_order_delivered_settlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wallet_id uuid;
  _net numeric;
  _cod numeric;
  _fee numeric;
BEGIN
  IF NEW.status IS DISTINCT FROM 'delivered' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'delivered' THEN
    RETURN NEW;
  END IF;
  -- Avoid double-credit: if a shipment exists, the shipment trigger handles it
  IF NEW.shipment_id IS NOT NULL THEN
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

  UPDATE public.wallets
    SET balance = balance + _net, updated_at = now()
    WHERE id = _wallet_id;

  INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, reference_id)
  VALUES (_wallet_id, 'cod_settlement', _net,
          'تسوية طلب مُسلَّم #' || substring(NEW.id::text, 1, 8), NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_delivered_settlement ON public.orders;
CREATE TRIGGER trg_order_delivered_settlement
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_delivered_settlement();
