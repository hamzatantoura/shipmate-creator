CREATE OR REPLACE FUNCTION public.track_order_by_sila_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean text;
  v_count int;
  v_order record;
  v_courier_name text;
  v_masked_phone text;
BEGIN
  -- Normalize: strip SL- prefix, lowercase, trim
  v_clean := lower(regexp_replace(coalesce(p_code, ''), '^[Ss][Ll]-?', ''));
  v_clean := regexp_replace(v_clean, '\s', '', 'g');

  IF length(v_clean) < 4 THEN
    RETURN jsonb_build_object('error', 'code_too_short');
  END IF;

  -- Count matches (cast UUID to text for prefix match)
  SELECT count(*) INTO v_count
  FROM orders
  WHERE deleted_at IS NULL
    AND id::text ILIKE v_clean || '%';

  IF v_count = 0 THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_count > 1 THEN
    RETURN jsonb_build_object('error', 'ambiguous');
  END IF;

  SELECT o.id, o.status, o.city, o.phone_number, o.created_at, o.updated_at,
         o.return_reason, o.courier_id, o.district_id
  INTO v_order
  FROM orders o
  WHERE o.deleted_at IS NULL
    AND o.id::text ILIKE v_clean || '%'
  LIMIT 1;

  -- Resolve courier name
  IF v_order.courier_id IS NOT NULL THEN
    SELECT name INTO v_courier_name FROM couriers WHERE id = v_order.courier_id;
  END IF;

  -- Mask phone: keep first 2 and last 2 chars, replace middle with *
  IF v_order.phone_number IS NOT NULL AND length(v_order.phone_number) >= 4 THEN
    v_masked_phone := substring(v_order.phone_number, 1, 2)
                   || repeat('*', greatest(length(v_order.phone_number) - 4, 0))
                   || substring(v_order.phone_number, length(v_order.phone_number) - 1, 2);
  ELSE
    v_masked_phone := '***';
  END IF;

  RETURN jsonb_build_object(
    'sila_code', 'SL-' || upper(substring(v_order.id::text, 1, 6)),
    'status', v_order.status,
    'city', v_order.city,
    'courier_name', v_courier_name,
    'phone_masked', v_masked_phone,
    'created_at', v_order.created_at,
    'updated_at', v_order.updated_at,
    'return_reason', v_order.return_reason
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_order_by_sila_code(text) TO anon, authenticated;