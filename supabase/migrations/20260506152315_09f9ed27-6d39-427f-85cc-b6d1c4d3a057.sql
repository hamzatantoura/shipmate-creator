
-- Phase 1: Expand platform_settings with all admin-controllable settings
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS platform_margin_visible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS collection_fee_visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_free_shipping_threshold numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verification_mode text NOT NULL DEFAULT 'beta',
  ADD COLUMN IF NOT EXISTS allow_international_phones boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS min_payout_amount numeric NOT NULL DEFAULT 50000,
  ADD COLUMN IF NOT EXISTS platform_whatsapp text,
  ADD COLUMN IF NOT EXISTS public_couriers_visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS product_max_images integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS readiness_required_fields jsonb NOT NULL DEFAULT
    '["store_name","contact_person","phone","whatsapp_number","province_id","warehouse_address"]'::jsonb;

-- Constrain verification_mode to known values
DO $$ BEGIN
  ALTER TABLE public.platform_settings
    ADD CONSTRAINT platform_settings_verification_mode_chk
    CHECK (verification_mode IN ('beta','production'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ensure exactly one settings row exists
INSERT INTO public.platform_settings (singleton)
SELECT true
WHERE NOT EXISTS (SELECT 1 FROM public.platform_settings);
