-- =====================================================================
-- P0 SECURITY FIX #2: Realtime Data Leak — orders, shipments, shipment_status_history
-- =====================================================================

-- ---------- ORDERS ----------
-- Existing SELECT policies are already scoped (merchant_id, vendor courier_id, admin).
-- Drop and recreate to guarantee a clean, minimal set with no overlap.
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Courier company views assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Merchants can view own orders" ON public.orders;

CREATE POLICY "orders_select_admin"
ON public.orders FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "orders_select_merchant_own"
ON public.orders FOR SELECT TO authenticated
USING (
  merchant_id = auth.uid()
  AND deleted_at IS NULL
);

CREATE POLICY "orders_select_vendor_assigned"
ON public.orders FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'vendor'::app_role)
  AND courier_id IS NOT NULL
  AND public.is_vendor_courier(courier_id)
);

-- ---------- SHIPMENTS ----------
-- LEAKY: "Users can view relevant shipments" let ANY vendor see ALL shipments.
DROP POLICY IF EXISTS "Users can view relevant shipments" ON public.shipments;

CREATE POLICY "shipments_select_admin"
ON public.shipments FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "shipments_select_merchant_own"
ON public.shipments FOR SELECT TO authenticated
USING (merchant_id = auth.uid());

CREATE POLICY "shipments_select_vendor_assigned"
ON public.shipments FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'vendor'::app_role)
  AND courier_id IS NOT NULL
  AND public.is_vendor_courier(courier_id)
);

-- Also tighten UPDATE: "Admin and vendor can update shipments" was overly broad
-- (any vendor could update any shipment). Replace with scoped policies.
DROP POLICY IF EXISTS "Admin and vendor can update shipments" ON public.shipments;

CREATE POLICY "shipments_update_admin"
ON public.shipments FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "shipments_update_merchant_own"
ON public.shipments FOR UPDATE TO authenticated
USING (merchant_id = auth.uid())
WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "shipments_update_vendor_assigned"
ON public.shipments FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'vendor'::app_role)
  AND courier_id IS NOT NULL
  AND public.is_vendor_courier(courier_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'vendor'::app_role)
  AND courier_id IS NOT NULL
  AND public.is_vendor_courier(courier_id)
);

-- ---------- SHIPMENT_STATUS_HISTORY ----------
-- LEAKY: "Authenticated can view status history" allowed ANY vendor (and any
-- authenticated user via the OR chain) to read all rows. Replace with strict,
-- per-shipment ownership checks.
DROP POLICY IF EXISTS "Authenticated can view status history" ON public.shipment_status_history;

CREATE POLICY "ssh_select_admin"
ON public.shipment_status_history FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ssh_select_merchant_own"
ON public.shipment_status_history FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.shipments s
    WHERE s.id = shipment_status_history.shipment_id
      AND s.merchant_id = auth.uid()
  )
);

CREATE POLICY "ssh_select_vendor_assigned"
ON public.shipment_status_history FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'vendor'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.shipments s
    WHERE s.id = shipment_status_history.shipment_id
      AND s.courier_id IS NOT NULL
      AND public.is_vendor_courier(s.courier_id)
  )
);

-- =====================================================================
-- Ensure RLS is enabled (defense-in-depth; should already be on)
-- =====================================================================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_status_history ENABLE ROW LEVEL SECURITY;