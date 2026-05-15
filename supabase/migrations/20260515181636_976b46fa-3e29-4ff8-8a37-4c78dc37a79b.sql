
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS external_website_url text;

-- Backfill missing slugs uniquely by appending part of user_id
UPDATE public.profiles
SET store_slug = lower(regexp_replace(
  coalesce(nullif(trim(store_name), ''), nullif(trim(contact_person), ''), 'store'),
  '[^a-zA-Z0-9\u0600-\u06FF]+', '-', 'g'
)) || '-' || substr(user_id::text, 1, 6)
WHERE store_slug IS NULL OR trim(store_slug) = '';

-- Resolve any existing duplicates (in case-insensitive sense)
WITH dups AS (
  SELECT id, store_slug, user_id,
    row_number() OVER (PARTITION BY lower(store_slug) ORDER BY created_at) AS rn
  FROM public.profiles
  WHERE store_slug IS NOT NULL
)
UPDATE public.profiles p
SET store_slug = p.store_slug || '-' || substr(p.user_id::text, 1, 6)
FROM dups d
WHERE p.id = d.id AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_store_slug_lower_idx
  ON public.profiles (lower(store_slug)) WHERE store_slug IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_public_merchant_info(p_merchant_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result json;
BEGIN
  SELECT json_build_object(
    'user_id', m.user_id,
    'store_name', m.store_name,
    'city', m.city,
    'logo_url', m.logo_url,
    'whatsapp_number', m.whatsapp_number,
    'external_website_url', m.external_website_url,
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
$$;

CREATE OR REPLACE FUNCTION public.get_public_merchant_by_slug(p_slug text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result json;
BEGIN
  SELECT json_build_object(
    'user_id', m.user_id,
    'store_name', m.store_name,
    'city', m.city,
    'logo_url', m.logo_url,
    'whatsapp_number', m.whatsapp_number,
    'external_website_url', m.external_website_url,
    'store_slug', p.store_slug,
    'is_active', m.is_active,
    'verification_status', m.verification_status
  ) INTO result
  FROM public.profiles p
  JOIN public.merchants m ON m.user_id = p.user_id
  WHERE lower(p.store_slug) = lower(p_slug)
    AND m.is_active = true
    AND m.verification_status = 'verified'
  LIMIT 1;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_merchant_by_slug(text) TO anon, authenticated;
