
-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Merchants can view own shipments" ON public.shipments;

-- Recreate with proper vendor access
CREATE POLICY "Users can view relevant shipments" ON public.shipments
FOR SELECT TO authenticated
USING (
  auth.uid() = merchant_id
  OR get_user_role(auth.uid()) = 'admin'
  OR get_user_role(auth.uid()) = 'vendor'
);
