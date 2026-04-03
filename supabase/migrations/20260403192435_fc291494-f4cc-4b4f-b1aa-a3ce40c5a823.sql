
DROP POLICY IF EXISTS "Merchants can update own shipments" ON public.shipments;

CREATE POLICY "Allow anon to update shipments" ON public.shipments
FOR UPDATE TO anon
USING (true)
WITH CHECK (true);
