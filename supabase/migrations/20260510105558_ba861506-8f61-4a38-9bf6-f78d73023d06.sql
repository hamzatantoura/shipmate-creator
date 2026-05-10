CREATE OR REPLACE FUNCTION public.track_order_by_sila_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_input text;
  v_clean text;
  v_count int;
  v_order record;
  v_courier_name text;
  v_masked_phone text;
BEGIN
  v_input := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));

  -- ATTEMPT 1: Exact match against shipments.tracking_number (e.g. SL-EE9864-SRNI)
  SELECT o.id, o.status, o.city, o.phone_number, o.created_at, o.updated_at,
         o.return_reason, o.courier_id, o.district_id
  INTO v_order
  FROM shipments s
  JOIN orders o ON o.shipment_id = s.id
  WHERE upper(s.tracking_number) = v_input
    AND o.deleted_at IS NULL
  LIMIT 1;

  IF v_order.id IS NULL THEN
    -- ATTEMPT 2: STRICT 6-char Sila code on orders.id
    v_clean := lower(regexp_replace(coalesce(p_code, ''), '^[Ss][Ll]-?', ''));
    v_clean := regexp_replace(v_clean, '\s', '', 'g');
    v_clean := replace(v_clean, '-', '');

    IF length(v_clean) <> 6 THEN
      RETURN jsonb_build_object('error', 'not_found');
    END IF;

    SELECT count(*) INTO v_count
    FROM orders
    WHERE deleted_at IS NULL
      AND lower(substring(replace(id::text, '-', ''), 1, 6)) = v_clean;

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
      AND lower(substring(replace(o.id::text, '-', ''), 1, 6)) = v_clean
    LIMIT 1;
  END IF;

  IF v_order.courier_id IS NOT NULL THEN
    SELECT name INTO v_courier_name FROM couriers WHERE id = v_order.courier_id;
  END IF;

  IF v_order.phone_number IS NOT NULL AND length(v_order.phone_number) >= 4 THEN
    v_masked_phone := substring(v_order.phone_number, 1, 2)
                   || repeat('*', greatest(length(v_order.phone_number) - 4, 0))
                   || substring(v_order.phone_number, length(v_order.phone_number) - 1, 2);
  ELSE
    v_masked_phone := '***';
  END IF;

  RETURN jsonb_build_object(
    'sila_code', 'SL-' || upper(substring(replace(v_order.id::text, '-', ''), 1, 6)),
    'status', v_order.status,
    'city', v_order.city,
    'courier_name', v_courier_name,
    'phone_masked', v_masked_phone,
    'created_at', v_order.created_at,
    'updated_at', v_order.updated_at,
    'return_reason', v_order.return_reason
  );
END;
$function$;