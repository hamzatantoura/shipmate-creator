
CREATE POLICY "Authenticated can view carriers"
ON public.carriers FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can view carrier_coverage"
ON public.carrier_coverage FOR SELECT
TO authenticated
USING (true);
