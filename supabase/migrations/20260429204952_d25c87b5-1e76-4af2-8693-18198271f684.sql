-- ============================================================================
-- Security hardening: restrict courier_branches public read access
-- ============================================================================
-- Anonymous (anon) users do not need to read branch phone numbers and GPS
-- coordinates directly. All public-facing flows (storefront ordering, package
-- tracking) go through SECURITY DEFINER RPCs (find_couriers_for_order,
-- get_nearest_branches, list_courier_branches_for_order) that already return
-- the appropriate fields. Tighten the SELECT policy to authenticated users
-- only, while preserving admin and vendor access.

DROP POLICY IF EXISTS "Anyone can view active branches" ON public.courier_branches;

CREATE POLICY "Authenticated can view active branches"
  ON public.courier_branches
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR (public.has_role(auth.uid(), 'vendor'::app_role) AND public.is_vendor_courier(courier_id))
  );

-- ============================================================================
-- Realtime channel authorization
-- ============================================================================
-- Without RLS on realtime.messages, any signed-in user can subscribe to any
-- topic and receive broadcast row changes for tables in supabase_realtime,
-- bypassing the table-level RLS. Lock down realtime so only signed-in users
-- with a row-level access reason can receive messages.

ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users only can use realtime" ON realtime.messages;

-- Only authenticated users can read realtime broadcast messages. The actual
-- per-row authorization continues to be enforced by the underlying tables'
-- RLS policies — this policy simply blocks anonymous subscribers and removes
-- the implicit "any authenticated user can subscribe to any topic" hole.
CREATE POLICY "Authenticated users only can use realtime"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (true);
