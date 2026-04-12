
-- Drop the broken anon-only policy
DROP POLICY IF EXISTS "anon_all_payouts" ON public.payout_requests;

-- Merchants can insert their own payout requests
CREATE POLICY "Merchants can insert own payouts"
ON public.payout_requests
FOR INSERT
TO authenticated
WITH CHECK (merchant_id = auth.uid());

-- Merchants can view their own payout requests
CREATE POLICY "Merchants can view own payouts"
ON public.payout_requests
FOR SELECT
TO authenticated
USING (merchant_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Admins can update payout requests
CREATE POLICY "Admins can update payouts"
ON public.payout_requests
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete payout requests
CREATE POLICY "Admins can delete payouts"
ON public.payout_requests
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
