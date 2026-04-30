DROP VIEW IF EXISTS public.couriers_public;

CREATE VIEW public.couriers_public AS
SELECT
  id,
  name,
  logo_url,
  city,
  is_active,
  integration_type,
  services,
  cod_fee_type,
  cod_fee_value,
  return_fee_percentage,
  created_at
FROM public.couriers
WHERE is_active = true;

GRANT SELECT ON public.couriers_public TO authenticated, anon;

COMMENT ON VIEW public.couriers_public IS 'Safe public courier directory used by merchant order creation and thermal shipping labels. Exposes active couriers only and excludes sensitive operational/financial fields.';