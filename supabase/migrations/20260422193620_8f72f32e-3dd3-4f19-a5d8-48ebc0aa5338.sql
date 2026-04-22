-- Drop existing admin policies on courier_settlements
DROP POLICY IF EXISTS "Admins update settlements" ON public.courier_settlements;
DROP POLICY IF EXISTS "Admins delete settlements" ON public.courier_settlements;
DROP POLICY IF EXISTS "Vendors view own settlements" ON public.courier_settlements;

-- Recreate with robust admin check (matches both user_roles and profiles)
CREATE POLICY "Admins update settlements"
ON public.courier_settlements
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.get_user_role(auth.uid()) = 'admin'::public.app_role
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.get_user_role(auth.uid()) = 'admin'::public.app_role
);

CREATE POLICY "Admins delete settlements"
ON public.courier_settlements
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.get_user_role(auth.uid()) = 'admin'::public.app_role
);

CREATE POLICY "Vendors and admins view settlements"
ON public.courier_settlements
FOR SELECT
TO authenticated
USING (
  (public.has_role(auth.uid(), 'vendor'::public.app_role) AND public.is_vendor_courier(courier_id))
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.get_user_role(auth.uid()) = 'admin'::public.app_role
);