
-- Allow authenticated merchants to insert their own products
CREATE POLICY "Merchants can insert own products"
ON public.products FOR INSERT TO authenticated
WITH CHECK (auth.uid() = merchant_id);

-- Allow authenticated merchants to update their own products
CREATE POLICY "Merchants can update own products"
ON public.products FOR UPDATE TO authenticated
USING (auth.uid() = merchant_id);

-- Allow authenticated merchants to delete their own products
CREATE POLICY "Merchants can delete own products"
ON public.products FOR DELETE TO authenticated
USING (auth.uid() = merchant_id);

-- Allow authenticated merchants to view their own products
CREATE POLICY "Merchants can view own products"
ON public.products FOR SELECT TO authenticated
USING (auth.uid() = merchant_id);
