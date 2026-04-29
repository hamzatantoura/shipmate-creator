
-- =====================================================
-- STEP 18: Financial Hardening
-- =====================================================

-- 1) Helper: compute current ledger balance for a merchant
CREATE OR REPLACE FUNCTION public.get_merchant_ledger_balance(_merchant_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(wt.amount), 0)::numeric
  FROM public.wallet_transactions wt
  JOIN public.wallets w ON w.id = wt.wallet_id
  WHERE w.merchant_id = _merchant_id;
$$;

-- 2) Helper: compute net amount a courier still owes the platform
CREATE OR REPLACE FUNCTION public.get_courier_net_owed(_courier_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cod_collected numeric := 0;
  _shipping_earnings numeric := 0;
  _cod_earnings numeric := 0;
  _return_earnings numeric := 0;
  _approved_settlements numeric := 0;
  _pending_settlements numeric := 0;
  _cod_type text;
  _cod_value numeric;
BEGIN
  SELECT cod_fee_type, COALESCE(cod_fee_value, 0)
    INTO _cod_type, _cod_value
  FROM public.couriers WHERE id = _courier_id;

  -- Collected cash on delivered orders
  SELECT
    COALESCE(SUM(COALESCE(o.final_sale_price, o.total_amount, 0)), 0),
    COALESCE(SUM(COALESCE(o.delivery_fee, 0)), 0),
    COALESCE(SUM(
      CASE WHEN _cod_type = 'percentage'
           THEN COALESCE(o.final_sale_price, o.total_amount, 0) * _cod_value / 100.0
           ELSE _cod_value END
    ), 0)
  INTO _cod_collected, _shipping_earnings, _cod_earnings
  FROM public.orders o
  WHERE o.courier_id = _courier_id
    AND o.status = 'delivered'
    AND o.deleted_at IS NULL;

  -- Returned orders: courier still earns shipping fee (per platform rule)
  SELECT COALESCE(SUM(COALESCE(o.delivery_fee, 0)), 0)
  INTO _return_earnings
  FROM public.orders o
  WHERE o.courier_id = _courier_id
    AND o.status = 'returned'
    AND o.deleted_at IS NULL;

  SELECT
    COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0),
    COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0)
  INTO _approved_settlements, _pending_settlements
  FROM public.courier_settlements
  WHERE courier_id = _courier_id;

  -- Net owed = collected cash − courier earnings − settlements (approved + pending reservation)
  RETURN _cod_collected
       - _shipping_earnings - _cod_earnings - _return_earnings
       - _approved_settlements - _pending_settlements;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_merchant_ledger_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_courier_net_owed(uuid) TO authenticated;

-- 3) Trigger: validate payout_requests against real ledger balance
CREATE OR REPLACE FUNCTION public.validate_payout_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _balance numeric;
  _pending numeric;
  _available numeric;
BEGIN
  -- Only validate on INSERT, or when amount/merchant changes
  IF TG_OP = 'UPDATE' AND NEW.amount = OLD.amount AND NEW.merchant_id = OLD.merchant_id THEN
    RETURN NEW;
  END IF;

  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'مبلغ التسوية يجب أن يكون أكبر من صفر' USING ERRCODE = '22023';
  END IF;

  _balance := public.get_merchant_ledger_balance(NEW.merchant_id);

  -- Reserve already-pending payouts (so merchant cannot double-spend)
  SELECT COALESCE(SUM(amount), 0) INTO _pending
  FROM public.payout_requests
  WHERE merchant_id = NEW.merchant_id
    AND status IN ('pending', 'processing')
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  _available := _balance - _pending;

  IF NEW.amount > _available THEN
    RAISE EXCEPTION 'المبلغ المطلوب (%) يتجاوز الرصيد المتاح للسحب (%)', NEW.amount, _available
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_payout_request ON public.payout_requests;
CREATE TRIGGER trg_validate_payout_request
  BEFORE INSERT OR UPDATE OF amount, merchant_id ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.validate_payout_request();

-- 4) Trigger: validate courier_settlements against real owed amount
CREATE OR REPLACE FUNCTION public.validate_courier_settlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _net_owed numeric;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.amount = OLD.amount AND NEW.courier_id = OLD.courier_id THEN
    RETURN NEW;
  END IF;

  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'مبلغ التسوية يجب أن يكون أكبر من صفر' USING ERRCODE = '22023';
  END IF;

  -- get_courier_net_owed already deducts pending+approved for this courier,
  -- but on INSERT the new row is not yet counted. So _net_owed represents what is
  -- still claimable BEFORE this new row.
  _net_owed := public.get_courier_net_owed(NEW.courier_id);

  IF TG_OP = 'INSERT' THEN
    IF NEW.amount > _net_owed THEN
      RAISE EXCEPTION 'المبلغ (%) يتجاوز المستحق الفعلي للمنصة (%)', NEW.amount, _net_owed
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_courier_settlement ON public.courier_settlements;
CREATE TRIGGER trg_validate_courier_settlement
  BEFORE INSERT OR UPDATE OF amount, courier_id ON public.courier_settlements
  FOR EACH ROW EXECUTE FUNCTION public.validate_courier_settlement();

-- 5) Idempotent admin function for approving top-ups
CREATE OR REPLACE FUNCTION public.approve_top_up(p_topup_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _topup RECORD;
  _wallet_id uuid;
  _exists boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'غير مصرّح' USING ERRCODE = '42501';
  END IF;

  -- Atomically claim the row (only if still pending)
  UPDATE public.top_up_requests
    SET status = 'completed', updated_at = now()
    WHERE id = p_topup_id AND status = 'pending'
  RETURNING * INTO _topup;

  IF _topup IS NULL THEN
    RAISE EXCEPTION 'طلب الشحن غير موجود أو سبق اعتماده' USING ERRCODE = '42501';
  END IF;

  IF _topup.amount IS NULL OR _topup.amount <= 0 THEN
    RAISE EXCEPTION 'مبلغ غير صالح' USING ERRCODE = '22023';
  END IF;

  -- Get/create wallet
  SELECT id INTO _wallet_id FROM public.wallets WHERE merchant_id = _topup.merchant_id LIMIT 1;
  IF _wallet_id IS NULL THEN
    INSERT INTO public.wallets (merchant_id, balance) VALUES (_topup.merchant_id, 0)
    RETURNING id INTO _wallet_id;
  END IF;

  -- Idempotency: skip if a topup ledger entry already exists for this request
  SELECT EXISTS(
    SELECT 1 FROM public.wallet_transactions
    WHERE reference_id = _topup.id AND type = 'topup'
  ) INTO _exists;

  IF NOT _exists THEN
    INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, reference_id)
    VALUES (_wallet_id, 'topup', _topup.amount,
            'شحن رصيد - ' || COALESCE(_topup.method, ''), _topup.id);

    UPDATE public.wallets SET balance = balance + _topup.amount, updated_at = now()
      WHERE id = _wallet_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'amount', _topup.amount);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_top_up(uuid) TO authenticated;

-- 6) Atomic admin function for approving courier settlements
CREATE OR REPLACE FUNCTION public.review_courier_settlement(
  p_settlement_id uuid,
  p_action text,            -- 'approve' or 'reject'
  p_admin_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'غير مصرّح' USING ERRCODE = '42501';
  END IF;

  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'إجراء غير صالح' USING ERRCODE = '22023';
  END IF;

  IF p_action = 'reject' AND (p_admin_note IS NULL OR length(btrim(p_admin_note)) = 0) THEN
    RAISE EXCEPTION 'يجب إدخال سبب الرفض' USING ERRCODE = '22023';
  END IF;

  -- Atomically claim
  UPDATE public.courier_settlements
    SET status = CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END,
        admin_note = NULLIF(btrim(COALESCE(p_admin_note, '')), ''),
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        updated_at = now()
    WHERE id = p_settlement_id AND status = 'pending'
  RETURNING * INTO _row;

  IF _row IS NULL THEN
    RAISE EXCEPTION 'التسوية غير موجودة أو سبق مراجعتها' USING ERRCODE = '42501';
  END IF;

  IF p_action = 'approve' THEN
    -- Reduce courier wallet liability (cash they owed the platform)
    UPDATE public.couriers
      SET wallet_balance = COALESCE(wallet_balance, 0) - _row.amount
      WHERE id = _row.courier_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END);
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_courier_settlement(uuid, text, text) TO authenticated;

-- 7) Reverse a completed merchant payout (admin-only)
CREATE OR REPLACE FUNCTION public.reverse_payout(p_payout_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _payout RECORD;
  _wallet RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'غير مصرّح' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _payout FROM public.payout_requests WHERE id = p_payout_id;
  IF _payout IS NULL THEN
    RAISE EXCEPTION 'طلب التسوية غير موجود';
  END IF;

  IF _payout.status <> 'completed' THEN
    RAISE EXCEPTION 'يمكن إلغاء التسويات المكتملة فقط' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _wallet FROM public.wallets WHERE merchant_id = _payout.merchant_id LIMIT 1;
  IF _wallet IS NULL THEN
    RAISE EXCEPTION 'محفظة التاجر غير موجودة';
  END IF;

  -- Refund: positive entry to ledger
  INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, reference_id)
  VALUES (_wallet.id, 'payout_reversal', _payout.amount,
          'إلغاء تسوية - ' || COALESCE(p_reason, 'بدون سبب'), _payout.id);

  UPDATE public.wallets SET balance = balance + _payout.amount, updated_at = now() WHERE id = _wallet.id;

  UPDATE public.payout_requests
    SET status = 'pending',
        admin_note = COALESCE(admin_note || E'\n', '') || 'تم الإلغاء: ' || COALESCE(p_reason, ''),
        updated_at = now()
    WHERE id = _payout_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reverse_payout(uuid, text) TO authenticated;

-- 8) Lock down direct UPDATE on courier_settlements by non-admins
-- (admins should use review_courier_settlement RPC). Keep existing INSERT for vendors.
DROP POLICY IF EXISTS "Admins update settlements" ON public.courier_settlements;
CREATE POLICY "Admins update settlements"
  ON public.courier_settlements FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
