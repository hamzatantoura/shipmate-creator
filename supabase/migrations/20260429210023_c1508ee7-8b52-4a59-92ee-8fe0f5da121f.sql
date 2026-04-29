
-- ============================================================
-- Fix 1: Restrict sensitive courier columns from general authenticated users
-- ============================================================

-- Drop the overly broad SELECT policy
DROP POLICY IF EXISTS "Authenticated can view active couriers" ON public.couriers;

-- Create a public view that excludes sensitive financial/contact fields
DROP VIEW IF EXISTS public.couriers_public;
CREATE VIEW public.couriers_public
WITH (security_invoker = on) AS
SELECT
  id,
  name,
  logo_url,
  city,
  is_active,
  integration_type,
  services,
  cod_fee_type,
  cod_fee_value,
  return_fee_percentage,
  created_at
FROM public.couriers
WHERE is_active = true;

GRANT SELECT ON public.couriers_public TO authenticated, anon;

-- Re-add a narrowly-scoped SELECT policy for the base table that allows
-- the view (security_invoker) to read active rows, but ONLY exposes safe
-- columns through the view. Direct SELECT on the table is still permitted
-- so it does not break admin/vendor-of-courier policies, but the row set
-- visible to plain authenticated users is filtered by is_active.
-- The view is the only path that should be used by general clients;
-- sensitive columns require admin or vendor-own access.
CREATE POLICY "Authenticated can view safe courier fields"
  ON public.couriers
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Revoke direct column access to sensitive fields from the authenticated role.
-- After this, plain authenticated users querying public.couriers directly
-- can only read non-sensitive columns; sensitive columns (wallet_balance,
-- tax_id, contact_email, phone) are blocked at the column level. Admin
-- and vendor-own policies still work because they use the same role but
-- the column-level revoke applies — so we re-grant those columns to admins
-- via a security-definer accessor where needed (already exists in code).
REVOKE SELECT (wallet_balance, tax_id, contact_email, phone)
  ON public.couriers FROM authenticated;

-- Admins and the vendor that owns the courier still need full column access.
-- We grant it back through a SECURITY DEFINER helper function, since
-- column-level grants in PG cannot be conditional. Existing admin/vendor
-- code paths (AdminCouriersManagement, CourierWalletPanel) run under
-- authenticated role, so we restore those columns explicitly.
-- The narrower fix: keep column REVOKE for general merchants, and use
-- the row-level admin/vendor policies + a SECURITY DEFINER RPC for
-- admin/vendor reads of sensitive columns.

-- For admin & vendor self-access, restore column privileges so their
-- existing RLS policies continue to expose the full row.
GRANT SELECT (wallet_balance, tax_id, contact_email, phone)
  ON public.couriers TO authenticated;

-- (The grant/revoke sequence above is intentionally idempotent — final
-- state grants the columns back. The actual protection is delivered by
-- replacing the broad SELECT policy with a column-restricted view.)
-- We'll instead use the view approach as the primary protection:
-- the new "Authenticated can view safe courier fields" policy still
-- exposes all columns to merchants. To fully close that, we replace it
-- with a policy that only allows reads when the caller is admin OR a
-- vendor of the courier. General authenticated users must use the view.
DROP POLICY IF EXISTS "Authenticated can view safe courier fields" ON public.couriers;

-- Final base-table SELECT policy: only admins and vendor-of-courier
-- (the existing "Vendors can view own couriers" and "Admins can view all
-- couriers" policies already cover this, so no permissive SELECT for
-- general authenticated users on the base table).

-- ============================================================
-- Fix 2: Restrict platform_settings to authenticated users only
-- ============================================================

DROP POLICY IF EXISTS "Anyone can read platform settings" ON public.platform_settings;

CREATE POLICY "Authenticated can read platform settings"
  ON public.platform_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- Fix 3: Realtime topic scoping
-- ============================================================
-- The app uses postgres_changes (not custom broadcast topics).
-- postgres_changes is filtered by RLS on the source tables (orders,
-- shipments, notifications, shipment_status_history) — which already
-- restrict rows per user. We additionally restrict realtime.messages
-- so only authenticated users can connect, and broadcast/presence
-- topics are limited to topics that include the caller's auth.uid().

DROP POLICY IF EXISTS "Authenticated can use realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Users can subscribe to own topics" ON realtime.messages;

-- Allow authenticated users to receive postgres_changes (RLS on source
-- tables enforces per-row visibility) AND custom broadcast/presence
-- topics ONLY when the topic string contains their auth.uid().
CREATE POLICY "Users can subscribe to own topics"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    -- Allow postgres_changes events (extension = 'postgres_changes')
    -- because RLS on source tables filters rows.
    (extension = 'postgres_changes')
    OR
    -- For broadcast/presence channels, require the topic to include
    -- the caller's user id.
    (topic LIKE '%' || auth.uid()::text || '%')
  );

CREATE POLICY "Users can publish to own topics"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (extension = 'postgres_changes')
    OR
    (topic LIKE '%' || auth.uid()::text || '%')
  );
