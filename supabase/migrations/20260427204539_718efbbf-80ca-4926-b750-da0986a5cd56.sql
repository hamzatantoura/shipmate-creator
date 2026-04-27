-- 1) Column to remember which branch the customer should pick up from
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS assigned_branch_id uuid;

COMMENT ON COLUMN public.orders.assigned_branch_id IS 'الفرع المُعيّن لاستلام الشحنة من قِبل العميل';

-- 2) Smart routing function
CREATE OR REPLACE FUNCTION public.find_couriers_for_order(
  merchant_province_id uuid,
  customer_province_id uuid,
  customer_lat double precision DEFAULT NULL,
  customer_lng double precision DEFAULT NULL
)
RETURNS TABLE(
  courier_id uuid,
  courier_name text,
  logo_url text,
  nearest_branch_id uuid,
  nearest_branch_name text,
  nearest_branch_address text,
  nearest_branch_phone text,
  nearest_branch_lat double precision,
  nearest_branch_lng double precision,
  distance_km double precision,
  total_branches_in_destination integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH dest_branches AS (
    SELECT
      b.id,
      b.courier_id,
      b.name,
      b.address_details,
      b.phone,
      b.lat,
      b.lng,
      CASE
        WHEN customer_lat IS NOT NULL AND customer_lng IS NOT NULL
             AND b.lat IS NOT NULL AND b.lng IS NOT NULL
        THEN 6371 * acos(
          LEAST(1.0, GREATEST(-1.0,
            cos(radians(customer_lat)) * cos(radians(b.lat))
            * cos(radians(b.lng) - radians(customer_lng))
            + sin(radians(customer_lat)) * sin(radians(b.lat))
          ))
        )
        ELSE NULL
      END AS dist
    FROM public.courier_branches b
    WHERE b.is_active = true
      AND b.province_id = customer_province_id
  ),
  origin_couriers AS (
    SELECT DISTINCT b.courier_id
    FROM public.courier_branches b
    WHERE b.is_active = true
      AND b.province_id = merchant_province_id
  ),
  ranked AS (
    SELECT
      db.*,
      ROW_NUMBER() OVER (
        PARTITION BY db.courier_id
        ORDER BY db.dist ASC NULLS LAST, db.name ASC
      ) AS rn,
      COUNT(*) OVER (PARTITION BY db.courier_id) AS branch_count
    FROM dest_branches db
    WHERE db.courier_id IN (SELECT courier_id FROM origin_couriers)
  )
  SELECT
    c.id              AS courier_id,
    c.name            AS courier_name,
    c.logo_url,
    r.id              AS nearest_branch_id,
    r.name            AS nearest_branch_name,
    r.address_details AS nearest_branch_address,
    r.phone           AS nearest_branch_phone,
    r.lat             AS nearest_branch_lat,
    r.lng             AS nearest_branch_lng,
    r.dist            AS distance_km,
    r.branch_count::int AS total_branches_in_destination
  FROM ranked r
  JOIN public.couriers c ON c.id = r.courier_id
  WHERE r.rn = 1
    AND c.is_active = true
  ORDER BY r.dist ASC NULLS LAST, c.name ASC;
$$;

-- 3) Helper for admins to quickly set district coordinates
CREATE OR REPLACE FUNCTION public.set_district_coords(
  p_district_id uuid,
  p_lat double precision,
  p_lng double precision
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'غير مصرّح';
  END IF;
  UPDATE public.districts
    SET lat = p_lat, lng = p_lng
    WHERE id = p_district_id;
END;
$$;