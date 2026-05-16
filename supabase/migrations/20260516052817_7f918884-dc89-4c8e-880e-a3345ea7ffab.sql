
-- 1. Products: add original_price, in_stock, category
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS original_price NUMERIC,
  ADD COLUMN IF NOT EXISTS in_stock BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS category TEXT;

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category) WHERE deleted_at IS NULL;

-- 2. Merchants: add banner_url, bio, operating_hours
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS banner_url TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS operating_hours TEXT;

-- 3. merchant_branches table
CREATE TABLE IF NOT EXISTS public.merchant_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_branches_merchant ON public.merchant_branches(merchant_id);

ALTER TABLE public.merchant_branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants manage own branches"
ON public.merchant_branches FOR ALL
TO authenticated
USING (auth.uid() = merchant_id)
WITH CHECK (auth.uid() = merchant_id);

CREATE POLICY "Admins manage all branches"
ON public.merchant_branches FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_merchant_branches_updated_at
BEFORE UPDATE ON public.merchant_branches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Public view of branches for verified active merchants only
CREATE OR REPLACE VIEW public.merchant_branches_public
WITH (security_invoker = false) AS
SELECT b.id, b.merchant_id, b.name, b.address, b.phone, b.whatsapp, b.is_primary
FROM public.merchant_branches b
INNER JOIN public.merchants m ON m.user_id = b.merchant_id
WHERE m.is_active = true AND m.verification_status = 'verified';

GRANT SELECT ON public.merchant_branches_public TO anon, authenticated;

-- 5. Storage bucket for store banners
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-banners', 'store-banners', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read store banners"
ON storage.objects FOR SELECT
USING (bucket_id = 'store-banners');

CREATE POLICY "Merchants upload own banner"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'store-banners' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Merchants update own banner"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'store-banners' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Merchants delete own banner"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'store-banners' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 6. Update get_public_merchant_info to include new fields
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
