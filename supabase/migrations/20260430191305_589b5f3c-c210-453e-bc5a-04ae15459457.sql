
-- ============================================
-- 1) Performance indexes
-- ============================================

-- Direct B-tree index for exact tracking_number lookups
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_number
  ON public.shipments (tracking_number);

-- Case-insensitive index for ilike fallback
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_number_upper
  ON public.shipments (upper(tracking_number));

-- Functional index for SL-XXXXXX code prefix matching against orders.id
CREATE INDEX IF NOT EXISTS idx_orders_id_normalized
  ON public.orders (upper(replace(id::text, '-', '')) text_pattern_ops);

-- Same for shipments.id (final fallback)
CREATE INDEX IF NOT EXISTS idx_shipments_id_normalized
  ON public.shipments (upper(replace(id::text, '-', '')) text_pattern_ops);

-- Speed up join from orders by shipment_id
CREATE INDEX IF NOT EXISTS idx_orders_shipment_id
  ON public.orders (shipment_id);


-- ============================================
-- 2) Smart unified lookup RPC
-- ============================================
-- SECURITY INVOKER: respects existing RLS on shipments / orders / couriers / courier_branches.
-- Returns enriched shipment row + courier name + branch name in a single round-trip.

CREATE OR REPLACE FUNCTION public.lookup_shipment_by_code(code text)
RETURNS TABLE (
  id uuid,
  order_id uuid,
  merchant_id uuid,
  courier_id uuid,
  tracking_number text,
  status text,
  receiver_name text,
  phone_number text,
  city shipment_city,
  detailed_address text,
  cod_amount numeric,
  collection_fee numeric,
  shipping_fee numeric,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  courier_name text,
  branch_name text
)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
DECLARE
  _cleaned     text := upper(regexp_replace(coalesce(code, ''), '\s+', '', 'g'));
  _no_prefix   text;
  _compact     text;
  _shipment_id uuid;
BEGIN
  IF length(_cleaned) < 4 THEN
    RETURN;
  END IF;

  _no_prefix := regexp_replace(_cleaned, '^SL[-_]?', '');
  _compact   := regexp_replace(_no_prefix, '[^A-Z0-9]', '', 'g');

  -- (1) Exact tracking_number match (case-insensitive, index-backed)
  SELECT s.id INTO _shipment_id
  FROM public.shipments s
  WHERE upper(s.tracking_number) = _cleaned
  LIMIT 1;

  -- (2) Match against orders.id prefix (Sila code SL-XXXXXX → first 6 chars of normalized UUID)
  IF _shipment_id IS NULL AND length(_compact) >= 4 THEN
    SELECT o.shipment_id INTO _shipment_id
    FROM public.orders o
    WHERE o.shipment_id IS NOT NULL
      AND upper(replace(o.id::text, '-', '')) LIKE _compact || '%'
    ORDER BY o.created_at DESC
    LIMIT 1;
  END IF;

  -- (3) Final fallback: shipments.id prefix
  IF _shipment_id IS NULL AND length(_compact) >= 4 THEN
    SELECT s.id INTO _shipment_id
    FROM public.shipments s
    WHERE upper(replace(s.id::text, '-', '')) LIKE _compact || '%'
    ORDER BY s.created_at DESC
    LIMIT 1;
  END IF;

  IF _shipment_id IS NULL THEN
    RETURN;
  END IF;

  -- Return enriched row (RLS still applies to each underlying table)
  RETURN QUERY
  SELECT
    s.id,
    s.order_id,
    s.merchant_id,
    s.courier_id,
    s.tracking_number,
    s.status,
    s.receiver_name,
    s.phone_number,
    s.city,
    s.detailed_address,
    s.cod_amount,
    s.collection_fee,
    s.shipping_fee,
    s.notes,
    s.created_at,
    s.updated_at,
    c.name AS courier_name,
    b.name AS branch_name
  FROM public.shipments s
  LEFT JOIN public.couriers c ON c.id = s.courier_id
  LEFT JOIN public.orders o   ON o.shipment_id = s.id
  LEFT JOIN public.courier_branches b ON b.id = o.assigned_branch_id
  WHERE s.id = _shipment_id
  LIMIT 1;
END;
$$;

-- Allow authenticated users to call it (RLS still enforced inside)
GRANT EXECUTE ON FUNCTION public.lookup_shipment_by_code(text) TO authenticated;
