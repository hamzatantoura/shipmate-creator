CREATE POLICY "Authenticated users can view active shipping zones"
ON public.shipping_zones FOR SELECT TO authenticated
USING (is_active = true);