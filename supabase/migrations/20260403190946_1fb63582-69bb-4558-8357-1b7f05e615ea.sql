
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Merchants can create own shipments" ON public.shipments;
DROP POLICY IF EXISTS "Merchants can view own shipments" ON public.shipments;

-- Allow anon to insert
CREATE POLICY "Allow anon to insert shipments" ON public.shipments
FOR INSERT TO anon
WITH CHECK (true);

-- Allow anon to select
CREATE POLICY "Allow anon to select shipments" ON public.shipments
FOR SELECT TO anon
USING (true);
