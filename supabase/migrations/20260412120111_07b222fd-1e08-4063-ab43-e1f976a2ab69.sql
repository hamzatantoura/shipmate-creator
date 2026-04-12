
-- Allow anon to read merchant shipping info for product pages
CREATE POLICY "Public can view active merchant info"
ON public.merchants
FOR SELECT
TO anon
USING (is_active = true);
