-- 1) Real Foreign Key between orders.courier_id and couriers.id
-- Clear stale references first to avoid FK violation
UPDATE public.orders o
SET courier_id = NULL
WHERE courier_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.couriers c WHERE c.id = o.courier_id);

ALTER TABLE public.orders
  ADD CONSTRAINT orders_courier_id_fkey
  FOREIGN KEY (courier_id) REFERENCES public.couriers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_courier_id ON public.orders(courier_id);

-- 2) Drop old (incorrect) policies that compared courier_id to auth.uid() directly
DROP POLICY IF EXISTS "Couriers view assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Couriers update assigned orders" ON public.orders;

-- 3) New policies: courier company users see/update orders where the assigned courier
--    record's user_id matches auth.uid()
CREATE POLICY "Courier company views assigned orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'vendor'::app_role)
  AND courier_id IN (SELECT id FROM public.couriers WHERE user_id = auth.uid())
);

CREATE POLICY "Courier company updates assigned orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'vendor'::app_role)
  AND courier_id IN (SELECT id FROM public.couriers WHERE user_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'vendor'::app_role)
  AND courier_id IN (SELECT id FROM public.couriers WHERE user_id = auth.uid())
);