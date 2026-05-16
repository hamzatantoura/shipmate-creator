ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.get_public_merchant_info(p_merchant_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE result json;
BEGIN
  SELECT json_build_object(
    'user_id', m.user_id,
    'store_name', m.store_name,
    'city', m.city,
    'logo_url', m.logo_url,
    'banner_url', m.banner_url,
    'bio', m.bio,
    'operating_hours', m.operating_hours,
    'whatsapp_number', m.whatsapp_number,
    'external_website_url', m.external_website_url,
    'social_links', m.social_links,
    'store_slug', p.store_slug,
    'is_active', m.is_active,
    'verification_status', m.verification_status
  ) INTO result
  FROM public.merchants m
  LEFT JOIN public.profiles p ON p.user_id = m.user_id
  WHERE m.user_id = p_merchant_user_id
    AND m.is_active = true
    AND m.verification_status = 'verified'
  LIMIT 1;
  RETURN result;
END;
$function$;