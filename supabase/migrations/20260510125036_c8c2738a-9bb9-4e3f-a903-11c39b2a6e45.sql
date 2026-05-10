-- 1. Couriers: restrict public anon access to a safe view only
DROP POLICY IF EXISTS "Public can view active courier directory" ON public.couriers;

DROP VIEW IF EXISTS public.couriers_public;
CREATE VIEW public.couriers_public
WITH (security_invoker = true)
AS
SELECT id, name, logo_url, city, services, is_active
FROM public.couriers
WHERE is_active = true;

GRANT SELECT ON public.couriers_public TO anon, authenticated;

CREATE POLICY "Authenticated can view active couriers minimal"
  ON public.couriers
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- 2. Profiles: prevent self-role escalation via trigger
CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can change a profile role';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_role_change_trg ON public.profiles;
CREATE TRIGGER prevent_profile_role_change_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_role_change();

-- 3. Standardize role checks
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view all wallets" ON public.wallets;
CREATE POLICY "Admins can view all wallets"
  ON public.wallets
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Merchants can manage own wallet" ON public.wallets;
CREATE POLICY "Merchants can manage own wallet"
  ON public.wallets
  FOR ALL
  TO authenticated
  USING (auth.uid() = merchant_id AND is_platform = false)
  WITH CHECK (auth.uid() = merchant_id AND is_platform = false);

DROP POLICY IF EXISTS "Admins delete settlements" ON public.courier_settlements;
CREATE POLICY "Admins delete settlements"
  ON public.courier_settlements
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Vendors and admins view settlements" ON public.courier_settlements;
CREATE POLICY "Vendors and admins view settlements"
  ON public.courier_settlements
  FOR SELECT
  TO authenticated
  USING (
    (public.has_role(auth.uid(), 'vendor'::app_role) AND public.is_vendor_courier(courier_id))
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 4. Set search_path on remaining helper functions
ALTER FUNCTION public._sila_alphabet() SET search_path = public;
ALTER FUNCTION public._sila_checksum(text) SET search_path = public;
ALTER FUNCTION public._sila_validate(text) SET search_path = public;
ALTER FUNCTION public.generate_sila_code() SET search_path = public;
ALTER FUNCTION public.map_order_city_to_shipment(text) SET search_path = public;
