DROP POLICY IF EXISTS orders_select_merchant_own ON public.orders;
CREATE POLICY orders_select_merchant_own ON public.orders
  FOR SELECT TO authenticated
  USING (merchant_id = auth.uid());