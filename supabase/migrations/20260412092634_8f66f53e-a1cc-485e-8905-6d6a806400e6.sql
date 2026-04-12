
-- Hierarchical shipping zones table
CREATE TABLE public.shipping_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Level 1: Province (required)
  province_name TEXT NOT NULL,
  province_name_ar TEXT NOT NULL,
  -- Level 2: Area/City (optional, NULL = province-level zone)
  area_name TEXT,
  area_name_ar TEXT,
  -- Level 3: Neighborhood (optional, NULL = area-level zone)
  neighborhood_name TEXT,
  neighborhood_name_ar TEXT,
  -- Pricing
  delivery_fee NUMERIC NOT NULL DEFAULT 0,
  -- Carrier assignment
  carrier_id UUID REFERENCES public.carriers(id) ON DELETE SET NULL,
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Ensure unique combinations
  UNIQUE(province_name, area_name, neighborhood_name)
);

-- Enable RLS
ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;

-- Everyone can read active zones
CREATE POLICY "Anyone can view active shipping zones"
ON public.shipping_zones
FOR SELECT
USING (is_active = true);

-- Authenticated users can also read (for admin UI showing inactive ones)
CREATE POLICY "Admins can view all shipping zones"
ON public.shipping_zones
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Only admins can insert
CREATE POLICY "Admins can insert shipping zones"
ON public.shipping_zones
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Only admins can update
CREATE POLICY "Admins can update shipping zones"
ON public.shipping_zones
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Only admins can delete
CREATE POLICY "Admins can delete shipping zones"
ON public.shipping_zones
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Index for fast lookups
CREATE INDEX idx_shipping_zones_province ON public.shipping_zones(province_name);
CREATE INDEX idx_shipping_zones_area ON public.shipping_zones(province_name, area_name);
CREATE INDEX idx_shipping_zones_active ON public.shipping_zones(is_active);

-- Auto-update timestamp trigger
CREATE TRIGGER update_shipping_zones_updated_at
BEFORE UPDATE ON public.shipping_zones
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
