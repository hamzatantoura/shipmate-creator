-- Soft delete: add deleted_at to products and orders
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Update RLS policies for products to exclude soft-deleted
DROP POLICY IF EXISTS "Merchants can view own products" ON public.products;
CREATE POLICY "Merchants can view own products"
  ON public.products FOR SELECT TO authenticated
  USING (auth.uid() = merchant_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Public can view active products" ON public.products;
CREATE POLICY "Public can view active products"
  ON public.products FOR SELECT TO anon
  USING (is_active = true AND deleted_at IS NULL);

-- Update merchant orders to exclude soft-deleted
DROP POLICY IF EXISTS "Merchants can view own orders" ON public.orders;
CREATE POLICY "Merchants can view own orders"
  ON public.orders FOR SELECT TO authenticated
  USING (merchant_id = auth.uid() AND deleted_at IS NULL);

-- Enable realtime for orders and shipments (for push notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shipments;