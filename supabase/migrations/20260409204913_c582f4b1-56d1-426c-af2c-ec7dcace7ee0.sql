CREATE POLICY "Merchants can view own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (merchant_id = auth.uid());

CREATE POLICY "Merchants can update own orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (merchant_id = auth.uid());