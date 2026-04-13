
-- ============ ORDERS ============
-- Drop insecure policies
DROP POLICY IF EXISTS "anon_all_orders" ON public.orders;
DROP POLICY IF EXISTS "Public can create orders" ON public.orders;

-- Admin can view all orders
CREATE POLICY "Admins can view all orders"
ON public.orders FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can update all orders
CREATE POLICY "Admins can update all orders"
ON public.orders FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Anon can insert orders (storefront checkout)
CREATE POLICY "Anon can create orders for storefront"
ON public.orders FOR INSERT TO anon
WITH CHECK (true);

-- Authenticated merchants can insert own orders
CREATE POLICY "Merchants can insert own orders"
ON public.orders FOR INSERT TO authenticated
WITH CHECK (merchant_id = auth.uid());

-- ============ SHIPMENT_STATUS_HISTORY ============
DROP POLICY IF EXISTS "anon_all_status_history" ON public.shipment_status_history;

CREATE POLICY "Authenticated can view status history"
ON public.shipment_status_history FOR SELECT TO authenticated
USING (
  shipment_id IN (
    SELECT id FROM public.shipments
    WHERE merchant_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'vendor'::app_role)
);

CREATE POLICY "System can insert status history"
ON public.shipment_status_history FOR INSERT TO authenticated
WITH CHECK (true);

-- ============ TOP_UP_REQUESTS ============
DROP POLICY IF EXISTS "anon_all_topup" ON public.top_up_requests;

CREATE POLICY "Merchants can view own top-up requests"
ON public.top_up_requests FOR SELECT TO authenticated
USING (merchant_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Merchants can create own top-up requests"
ON public.top_up_requests FOR INSERT TO authenticated
WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "Admins can update top-up requests"
ON public.top_up_requests FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ WALLET_TRANSACTIONS ============
DROP POLICY IF EXISTS "anon_all_wallet_txns" ON public.wallet_transactions;

CREATE POLICY "Merchants can view own wallet transactions"
ON public.wallet_transactions FOR SELECT TO authenticated
USING (
  wallet_id IN (
    SELECT id FROM public.wallets WHERE merchant_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "System can insert wallet transactions"
ON public.wallet_transactions FOR INSERT TO authenticated
WITH CHECK (true);

-- ============ PRODUCTS ============
DROP POLICY IF EXISTS "anon_all_products" ON public.products;
