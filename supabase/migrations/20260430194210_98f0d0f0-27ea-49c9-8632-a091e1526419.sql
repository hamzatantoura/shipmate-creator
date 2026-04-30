CREATE OR REPLACE FUNCTION public.get_current_vendor_courier_profile()
RETURNS TABLE (
  id uuid,
  name text,
  logo_url text,
  is_active boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT c.id, c.name, c.logo_url, c.is_active
  FROM public.couriers c
  WHERE c.vendor_id = uid
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_current_vendor_courier_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_vendor_courier_profile() TO authenticated;