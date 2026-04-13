
-- Create a SECURITY DEFINER function to handle payout completion safely
CREATE OR REPLACE FUNCTION public.complete_payout(p_payout_id uuid, p_new_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _payout RECORD;
  _wallet RECORD;
  _net_deduction numeric;
BEGIN
  -- Only admins can call this
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'غير مصرّح';
  END IF;

  -- Get payout details
  SELECT * INTO _payout FROM public.payout_requests WHERE id = p_payout_id;
  IF _payout IS NULL THEN
    RAISE EXCEPTION 'طلب التسوية غير موجود';
  END IF;

  -- Update payout status
  UPDATE public.payout_requests SET status = p_new_status, updated_at = now() WHERE id = p_payout_id;

  -- If completing, deduct from wallet
  IF p_new_status = 'completed' AND _payout.status != 'completed' THEN
    SELECT * INTO _wallet FROM public.wallets WHERE merchant_id = _payout.merchant_id LIMIT 1;
    IF _wallet IS NULL THEN
      RAISE EXCEPTION 'محفظة التاجر غير موجودة';
    END IF;

    _net_deduction := _payout.amount;

    UPDATE public.wallets SET balance = balance - _net_deduction, updated_at = now() WHERE id = _wallet.id;

    INSERT INTO public.wallet_transactions (wallet_id, type, amount, description, reference_id)
    VALUES (_wallet.id, 'payout', -_net_deduction, 'تسوية مالية - ' || COALESCE(_payout.method, ''), _payout.id);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_payout(uuid, text) TO authenticated;
