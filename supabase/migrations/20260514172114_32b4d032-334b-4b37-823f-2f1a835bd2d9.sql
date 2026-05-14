
DROP VIEW IF EXISTS public.couriers_public CASCADE;

CREATE VIEW public.couriers_public
WITH (security_invoker = true)
AS
SELECT
  id,
  name,
  logo_url,
  city,
  services,
  is_active,
  cod_fee_type,
  cod_fee_value,
  cod_collection_responsibility,
  return_fee_type,
  return_fee_percentage,
  return_fee_fixed,
  max_delivery_attempts,
  delivery_sla_hours,
  policy_notes
FROM public.couriers
WHERE is_active = true;

GRANT SELECT ON public.couriers_public TO authenticated, anon;
