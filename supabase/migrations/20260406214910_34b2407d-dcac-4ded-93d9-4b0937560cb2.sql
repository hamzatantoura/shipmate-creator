
-- Add geolocation to profiles for merchant locations
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS latitude numeric,
ADD COLUMN IF NOT EXISTS longitude numeric;

-- Create couriers table (drivers working for shipping companies)
CREATE TABLE public.couriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;

-- Vendors can manage their own couriers
CREATE POLICY "Vendors can view own couriers"
ON public.couriers FOR SELECT
TO authenticated
USING (
  vendor_id IN (
    SELECT user_id FROM public.profiles WHERE user_id = auth.uid() AND role = 'vendor'
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Vendors can insert own couriers"
ON public.couriers FOR INSERT
TO authenticated
WITH CHECK (
  vendor_id = auth.uid() AND public.has_role(auth.uid(), 'vendor')
);

CREATE POLICY "Vendors can update own couriers"
ON public.couriers FOR UPDATE
TO authenticated
USING (vendor_id = auth.uid() AND public.has_role(auth.uid(), 'vendor'));

CREATE POLICY "Vendors can delete own couriers"
ON public.couriers FOR DELETE
TO authenticated
USING (vendor_id = auth.uid() AND public.has_role(auth.uid(), 'vendor'));

-- Add courier_id to shipments for dispatch assignment
ALTER TABLE public.shipments
ADD COLUMN IF NOT EXISTS courier_id uuid;
