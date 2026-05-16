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
  v_tracking text;
BEGIN
  v_input := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));

  IF v_input = '' THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  -- ATTEMPT 1: New-format full code SL-XXXXXXXX-C (validate checksum first)
  IF v_input ~ '^SL-[A-Z2-9]{8}-[A-Z2-9]$' THEN
    IF NOT public._sila_validate(v_input) THEN
      RETURN jsonb_build_object('error', 'invalid_code');
    END IF;
    SELECT o.id, o.status, o.city, o.phone_number, o.created_at, o.updated_at,
           o.return_reason, o.courier_id, o.district_id, s.tracking_number, o.shipment_id
    INTO v_order
    FROM shipments s
    JOIN orders o ON o.shipment_id = s.id
    WHERE s.tracking_number = v_input
      AND o.deleted_at IS NULL
    LIMIT 1;
    IF v_order.id IS NULL THEN
      RETURN jsonb_build_object('error', 'not_found');
    END IF;
  ELSE
    -- ATTEMPT 2: Legacy exact match
    SELECT o.id, o.status, o.city, o.phone_number, o.created_at, o.updated_at,
           o.return_reason, o.courier_id, o.district_id, s.tracking_number, o.shipment_id
    INTO v_order
    FROM shipments s
    JOIN orders o ON o.shipment_id = s.id
    WHERE upper(s.tracking_number) = v_input
      AND o.deleted_at IS NULL
    LIMIT 1;

    -- ATTEMPT 3: UUID prefix match (6-32 chars) for orders with/without shipment
    IF v_order.id IS NULL THEN
      v_clean := lower(replace(replace(v_input, 'SL-', ''), '-', ''));
      IF length(v_clean) < 6 THEN
        RETURN jsonb_build_object('error', 'code_too_short');
      END IF;
      IF length(v_clean) > 32 THEN
        RETURN jsonb_build_object('error', 'not_found');
      END IF;

      SELECT count(*) INTO v_count
      FROM orders o
      WHERE replace(o.id::text, '-', '') LIKE v_clean || '%'
        AND o.deleted_at IS NULL;

      IF v_count = 0 THEN
        RETURN jsonb_build_object('error', 'not_found');
      ELSIF v_count > 1 THEN
        RETURN jsonb_build_object('error', 'ambiguous');
      END IF;

      SELECT o.id, o.status, o.city, o.phone_number, o.created_at, o.updated_at,
             o.return_reason, o.courier_id, o.district_id, s.tracking_number, o.shipment_id
      INTO v_order
      FROM orders o
      LEFT JOIN shipments s ON s.id = o.shipment_id
      WHERE replace(o.id::text, '-', '') LIKE v_clean || '%'
        AND o.deleted_at IS NULL
      LIMIT 1;
    END IF;
  END IF;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_order.courier_id IS NOT NULL THEN
    SELECT name INTO v_courier_name FROM couriers WHERE id = v_order.courier_id;
  END IF;

  IF v_order.phone_number IS NOT NULL AND length(v_order.phone_number) >= 4 THEN
    v_masked_phone :=
      substring(v_order.phone_number, 1, 2) ||
      repeat('*', greatest(length(v_order.phone_number) - 4, 0)) ||
      substring(v_order.phone_number, length(v_order.phone_number) - 1, 2);
  ELSE
    v_masked_phone := '****';
  END IF;

  v_tracking := COALESCE(
    v_order.tracking_number,
    'SL-' || upper(substring(replace(v_order.id::text, '-', ''), 1, 8))
  );

  RETURN jsonb_build_object(
    'sila_code', v_tracking,
    'status', v_order.status,
    'city', v_order.city,
    'courier_name', v_courier_name,
    'phone_masked', v_masked_phone,
    'created_at', v_order.created_at,
    'updated_at', v_order.updated_at,
    'return_reason', v_order.return_reason,
    'has_shipment', (v_order.shipment_id IS NOT NULL)
  );
END;
$function$;