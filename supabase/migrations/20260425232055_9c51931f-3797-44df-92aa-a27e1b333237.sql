-- 1) Add lat/lng to districts (non-destructive)
ALTER TABLE public.districts
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

-- 2) Create courier_branches table
CREATE TABLE IF NOT EXISTS public.courier_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  name text NOT NULL,
  province_id uuid REFERENCES public.provinces(id) ON DELETE SET NULL,
  district_id uuid REFERENCES public.districts(id) ON DELETE SET NULL,
  address_details text,
  lat double precision,
  lng double precision,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courier_branches_courier ON public.courier_branches(courier_id);
CREATE INDEX IF NOT EXISTS idx_courier_branches_province ON public.courier_branches(province_id);
CREATE INDEX IF NOT EXISTS idx_courier_branches_district ON public.courier_branches(district_id);
CREATE INDEX IF NOT EXISTS idx_courier_branches_active ON public.courier_branches(is_active);

ALTER TABLE public.courier_branches ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "Anyone can view active branches" ON public.courier_branches;
CREATE POLICY "Anyone can view active branches"
  ON public.courier_branches FOR SELECT
  USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role) OR (has_role(auth.uid(), 'vendor'::app_role) AND is_vendor_courier(courier_id)));

DROP POLICY IF EXISTS "Admins manage branches" ON public.courier_branches;
CREATE POLICY "Admins manage branches"
  ON public.courier_branches FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Vendors manage own branches" ON public.courier_branches;
CREATE POLICY "Vendors manage own branches"
  ON public.courier_branches FOR ALL
  USING (has_role(auth.uid(), 'vendor'::app_role) AND is_vendor_courier(courier_id))
  WITH CHECK (has_role(auth.uid(), 'vendor'::app_role) AND is_vendor_courier(courier_id));

CREATE TRIGGER trg_courier_branches_updated_at
  BEFORE UPDATE ON public.courier_branches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Haversine nearest branches function
CREATE OR REPLACE FUNCTION public.get_nearest_branches(
  target_lat double precision,
  target_lng double precision,
  max_radius_km double precision DEFAULT 30
)
RETURNS TABLE (
  id uuid,
  courier_id uuid,
  courier_name text,
  name text,
  province_id uuid,
  district_id uuid,
  address_details text,
  lat double precision,
  lng double precision,
  phone text,
  distance_km double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id,
    b.courier_id,
    c.name AS courier_name,
    b.name,
    b.province_id,
    b.district_id,
    b.address_details,
    b.lat,
    b.lng,
    b.phone,
    (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(target_lat)) * cos(radians(b.lat))
          * cos(radians(b.lng) - radians(target_lng))
          + sin(radians(target_lat)) * sin(radians(b.lat))
        ))
      )
    ) AS distance_km
  FROM public.courier_branches b
  LEFT JOIN public.couriers c ON c.id = b.courier_id
  WHERE b.is_active = true
    AND b.lat IS NOT NULL AND b.lng IS NOT NULL
    AND (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(target_lat)) * cos(radians(b.lat))
          * cos(radians(b.lng) - radians(target_lng))
          + sin(radians(target_lat)) * sin(radians(b.lat))
        ))
      )
    ) <= max_radius_km
  ORDER BY distance_km ASC;
$$;