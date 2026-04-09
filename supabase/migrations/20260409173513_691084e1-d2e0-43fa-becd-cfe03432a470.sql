
-- Replace size_category with weight_kg on products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS weight_kg numeric NOT NULL DEFAULT 1;
ALTER TABLE public.products DROP COLUMN IF EXISTS size_category;
