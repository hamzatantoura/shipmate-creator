
-- Allow vendors (courier companies) to view wallet_transactions
-- whose reference_id corresponds to an order or shipment assigned to one of their couriers.
DROP POLICY IF EXISTS "Vendors view wallet tx for own orders" ON public.wallet_transactions;

CREATE POLICY "Vendors view wallet tx for own orders"
ON public.wallet_transactions
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'vendor'::app_role)
  AND reference_id IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = wallet_transactions.reference_id
        AND o.courier_id IS NOT NULL
        AND public.is_vendor_courier(o.courier_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.shipments s
      WHERE s.id = wallet_transactions.reference_id
        AND s.courier_id IS NOT NULL
        AND public.is_vendor_courier(s.courier_id)
    )
  )
);
