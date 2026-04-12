
-- Add package dimensions to products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS length_cm numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS width_cm numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS height_cm numeric DEFAULT 0;

-- Add pricing engine columns to shipments
ALTER TABLE public.shipments
ADD COLUMN IF NOT EXISTS carrier_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS platform_margin numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS collection_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS merchant_shipping_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS volumetric_weight numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS billable_weight numeric DEFAULT 0;
