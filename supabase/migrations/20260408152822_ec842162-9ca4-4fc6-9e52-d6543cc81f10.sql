
-- Size category enum
CREATE TYPE public.size_category AS ENUM ('small', 'medium', 'large');

-- Add new columns to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS size_category size_category NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- Create index on slug for fast lookups
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);

-- Product images table (multiple images per product)
CREATE TABLE public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- Anyone can view product images (public storefront)
CREATE POLICY "Public can view product images"
  ON public.product_images FOR SELECT
  USING (true);

-- Merchants can manage their product images
CREATE POLICY "Merchants can insert product images"
  ON public.product_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.merchant_id = auth.uid()
    )
  );

CREATE POLICY "Merchants can delete product images"
  ON public.product_images FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.merchant_id = auth.uid()
    )
  );

-- Add final_sale_price and customer location to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS final_sale_price numeric,
  ADD COLUMN IF NOT EXISTS customer_lat numeric,
  ADD COLUMN IF NOT EXISTS customer_lng numeric;

-- Add store_slug to profiles for storefront URLs
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS store_slug text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_profiles_store_slug ON public.profiles(store_slug);

-- Public can view products (for storefront)
CREATE POLICY "Public can view active products"
  ON public.products FOR SELECT TO anon
  USING (is_active = true);

-- Public can insert orders (customer ordering from storefront)  
CREATE POLICY "Public can create orders"
  ON public.orders FOR INSERT TO anon
  WITH CHECK (true);
