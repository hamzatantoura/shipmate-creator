DROP POLICY IF EXISTS "Courier company views assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Courier company updates assigned orders" ON public.orders;

CREATE POLICY "Courier company views assigned orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'vendor'::app_role)
  AND courier_id IN (SELECT id FROM public.couriers WHERE vendor_id = auth.uid())
);

CREATE POLICY "Courier company updates assigned orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'vendor'::app_role)
  AND courier_id IN (SELECT id FROM public.couriers WHERE vendor_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'vendor'::app_role)
  AND courier_id IN (SELECT id FROM public.couriers WHERE vendor_id = auth.uid())
);