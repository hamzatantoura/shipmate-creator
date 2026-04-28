CREATE OR REPLACE FUNCTION public.list_courier_branches_for_order(
  p_courier_id uuid,
  p_customer_province_id uuid,
  p_customer_lat double precision DEFAULT NULL,
  p_customer_lng double precision DEFAULT NULL
)
RETURNS TABLE (
  branch_id uuid,
  branch_name text,
  address_details text,
  phone text,
  lat double precision,
  lng double precision,
  distance_km double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id          AS branch_id,
    b.name        AS branch_name,
    b.address_details,
    b.phone,
    b.lat,
    b.lng,
    CASE
      WHEN p_customer_lat IS NOT NULL AND p_customer_lng IS NOT NULL
           AND b.lat IS NOT NULL AND b.lng IS NOT NULL
      THEN 6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(p_customer_lat)) * cos(radians(b.lat))
          * cos(radians(b.lng) - radians(p_customer_lng))
          + sin(radians(p_customer_lat)) * sin(radians(b.lat))
        ))
      )
      ELSE NULL
    END AS distance_km
  FROM public.courier_branches b
  WHERE b.is_active = true
    AND b.courier_id = p_courier_id
    AND b.province_id = p_customer_province_id
  ORDER BY distance_km ASC NULLS LAST, b.name ASC;
$$;