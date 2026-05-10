
-- ==========================================================================
-- Strong Sila Code generator (shared between DB and frontend)
-- Format:  SL-XXXXXXXX-C
--   8 random chars from 31-char alphabet (no 0/1/I/L/O)
--   1 checksum char  = sum(indices) mod 31, mapped back to alphabet
-- Search space: 31^8 ≈ 8.5e11
-- ==========================================================================

CREATE OR REPLACE FUNCTION public._sila_alphabet()
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'::text $$;

CREATE OR REPLACE FUNCTION public._sila_checksum(p_body text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_alphabet text := public._sila_alphabet();
  v_sum int := 0;
  v_idx int;
  i int;
BEGIN
  FOR i IN 1..length(p_body) LOOP
    v_idx := position(substring(p_body, i, 1) IN v_alphabet) - 1;
    IF v_idx < 0 THEN
      RETURN NULL; -- invalid char
    END IF;
    v_sum := v_sum + v_idx;
  END LOOP;
  RETURN substring(v_alphabet, (v_sum % 31) + 1, 1);
END;
$$;

CREATE OR REPLACE FUNCTION public._sila_validate(p_code text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_clean text;
  v_body text;
  v_check text;
BEGIN
  IF p_code IS NULL THEN RETURN FALSE; END IF;
  v_clean := upper(regexp_replace(p_code, '\s', '', 'g'));
  -- Must be SL-XXXXXXXX-C (length 13)
  IF v_clean !~ '^SL-[A-Z2-9]{8}-[A-Z2-9]$' THEN RETURN FALSE; END IF;
  v_body := substring(v_clean, 4, 8);
  v_check := substring(v_clean, 13, 1);
  RETURN public._sila_checksum(v_body) = v_check;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_sila_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_alphabet text := public._sila_alphabet();
  v_body text;
  v_code text;
  v_attempts int := 0;
  v_byte int;
  i int;
BEGIN
  LOOP
    v_body := '';
    -- 8 random chars from 31-char alphabet using gen_random_bytes
    FOR i IN 1..8 LOOP
      v_byte := get_byte(extensions.gen_random_bytes(1), 0);
      v_body := v_body || substring(v_alphabet, (v_byte % 31) + 1, 1);
    END LOOP;
    v_code := 'SL-' || v_body || '-' || public._sila_checksum(v_body);

    -- Ensure uniqueness against existing shipments
    IF NOT EXISTS (SELECT 1 FROM public.shipments WHERE tracking_number = v_code) THEN
      RETURN v_code;
    END IF;

    v_attempts := v_attempts + 1;
    IF v_attempts >= 5 THEN
      -- Astronomically unlikely; surface as error rather than infinite loop
      RAISE EXCEPTION 'Could not generate unique Sila code after % attempts', v_attempts;
    END IF;
  END LOOP;
END;
$$;

-- ==========================================================================
-- Use new generator in the order->shipment trigger
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.create_shipment_for_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_shipment_id uuid;
  _tracking text;
  _cod numeric;
  _fee numeric;
BEGIN
  IF new.shipment_id IS NOT NULL THEN
    RETURN new;
  END IF;

  _cod := COALESCE(new.final_sale_price, new.total_amount, 0);
  _fee := COALESCE(new.delivery_fee, 0);
  _tracking := public.generate_sila_code();

  INSERT INTO public.shipments (
    order_id, merchant_id, courier_id,
    receiver_name, phone_number, city, detailed_address,
    cod_amount, collection_fee, shipping_fee,
    tracking_number, status
  ) VALUES (
    new.id, new.merchant_id, new.courier_id,
    new.receiver_name, new.phone_number,
    public.map_order_city_to_shipment(new.city),
    new.detailed_address,
    _cod, _fee, _fee,
    _tracking, 'pending'
  )
  RETURNING id INTO _new_shipment_id;

  UPDATE public.orders
    SET shipment_id = _new_shipment_id
    WHERE id = new.id;

  RETURN new;
END;
$$;

-- ==========================================================================
-- Update tracking RPC: validate checksum on new-format codes; keep legacy
-- exact-match and 6-char fallback for old shipments.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.track_order_by_sila_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
           o.return_reason, o.courier_id, o.district_id, s.tracking_number
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
    -- ATTEMPT 2: Legacy exact match (e.g. SL-EE9864-SRNI old format)
    SELECT o.id, o.status, o.city, o.phone_number, o.created_at, o.updated_at,
           o.return_reason, o.courier_id, o.district_id, s.tracking_number
    INTO v_order
    FROM shipments s
    JOIN orders o ON o.shipment_id = s.id
    WHERE upper(s.tracking_number) = v_input
      AND o.deleted_at IS NULL
    LIMIT 1;

    -- ATTEMPT 3: Legacy 6-char short code (SL-XXXXXX) → UUID prefix match
    IF v_order.id IS NULL THEN
      v_clean := replace(replace(v_input, 'SL-', ''), '-', '');
      IF length(v_clean) <> 6 THEN
        RETURN jsonb_build_object('error', 'not_found');
      END IF;

      SELECT count(*) INTO v_count
      FROM orders o
      WHERE upper(replace(o.id::text, '-', '')) LIKE v_clean || '%'
        AND o.deleted_at IS NULL;

      IF v_count = 0 THEN
        RETURN jsonb_build_object('error', 'not_found');
      ELSIF v_count > 1 THEN
        RETURN jsonb_build_object('error', 'ambiguous');
      END IF;

      SELECT o.id, o.status, o.city, o.phone_number, o.created_at, o.updated_at,
             o.return_reason, o.courier_id, o.district_id, s.tracking_number
      INTO v_order
      FROM orders o
      LEFT JOIN shipments s ON s.id = o.shipment_id
      WHERE upper(replace(o.id::text, '-', '')) LIKE v_clean || '%'
        AND o.deleted_at IS NULL
      LIMIT 1;
    END IF;
  END IF;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  -- Resolve courier name (privacy-safe — public field)
  IF v_order.courier_id IS NOT NULL THEN
    SELECT name INTO v_courier_name FROM couriers WHERE id = v_order.courier_id;
  END IF;

  -- Mask phone (keep first 2 + last 2 digits)
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
    'SL-' || upper(substring(replace(v_order.id::text, '-', ''), 1, 6))
  );

  RETURN jsonb_build_object(
    'sila_code', v_tracking,
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
