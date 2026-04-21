-- ============= PHASE 1: Database Integrity & Performance =============

-- 1. Drop legacy column (cod_fee_percentage superseded by cod_fee_type/value)
ALTER TABLE public.couriers DROP COLUMN IF EXISTS cod_fee_percentage;

-- 2. Clean up orphan FK candidates before adding constraints
UPDATE public.orders SET courier_id = NULL
  WHERE courier_id IS NOT NULL
    AND courier_id NOT IN (SELECT id FROM public.couriers);

UPDATE public.orders SET district_id = NULL
  WHERE district_id IS NOT NULL
    AND district_id NOT IN (SELECT id FROM public.districts);

UPDATE public.couriers SET vendor_id = NULL
  WHERE vendor_id IS NOT NULL
    AND vendor_id NOT IN (SELECT id FROM auth.users);

-- 3. Add Foreign Keys for referential integrity
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_courier_id_fkey,
  ADD CONSTRAINT orders_courier_id_fkey
    FOREIGN KEY (courier_id) REFERENCES public.couriers(id) ON DELETE SET NULL;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_district_id_fkey,
  ADD CONSTRAINT orders_district_id_fkey
    FOREIGN KEY (district_id) REFERENCES public.districts(id) ON DELETE SET NULL;

ALTER TABLE public.couriers
  DROP CONSTRAINT IF EXISTS couriers_vendor_id_fkey,
  ADD CONSTRAINT couriers_vendor_id_fkey
    FOREIGN KEY (vendor_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4. Performance: SECURITY DEFINER helper to replace inline subqueries in RLS
CREATE OR REPLACE FUNCTION public.is_vendor_courier(_courier_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.couriers
    WHERE id = _courier_id AND vendor_id = auth.uid()
  )
$$;

-- 5. Replace the vendor RLS policies on orders with the helper-based version
DROP POLICY IF EXISTS "Courier company views assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Courier company updates assigned orders" ON public.orders;

CREATE POLICY "Courier company views assigned orders"
ON public.orders FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'vendor'::app_role)
  AND courier_id IS NOT NULL
  AND public.is_vendor_courier(courier_id)
);

CREATE POLICY "Courier company updates assigned orders"
ON public.orders FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'vendor'::app_role)
  AND courier_id IS NOT NULL
  AND public.is_vendor_courier(courier_id)
)
WITH CHECK (
  has_role(auth.uid(), 'vendor'::app_role)
  AND courier_id IS NOT NULL
  AND public.is_vendor_courier(courier_id)
);

-- 6. Indexes to back the new FKs (huge perf win for joins/filters)
CREATE INDEX IF NOT EXISTS idx_orders_courier_id   ON public.orders(courier_id);
CREATE INDEX IF NOT EXISTS idx_orders_district_id  ON public.orders(district_id);
CREATE INDEX IF NOT EXISTS idx_couriers_vendor_id  ON public.couriers(vendor_id);
