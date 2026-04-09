
-- Product variants table for sizes, colors, capacity
CREATE TABLE public.product_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_type TEXT NOT NULL, -- 'size', 'color', 'capacity_ml'
  variant_value TEXT NOT NULL,
  price_adjustment NUMERIC NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- Merchants can manage variants of their own products
CREATE POLICY "Merchants can insert own product variants"
ON public.product_variants FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM products WHERE id = product_id AND merchant_id = auth.uid()));

CREATE POLICY "Merchants can update own product variants"
ON public.product_variants FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM products WHERE id = product_id AND merchant_id = auth.uid()));

CREATE POLICY "Merchants can delete own product variants"
ON public.product_variants FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM products WHERE id = product_id AND merchant_id = auth.uid()));

-- Anyone can view variants
CREATE POLICY "Anyone can view product variants"
ON public.product_variants FOR SELECT TO public
USING (true);

-- Add index for performance
CREATE INDEX idx_product_variants_product_id ON public.product_variants(product_id);
