-- Remove default values from platform_settings so all fees must be set by admin
ALTER TABLE public.platform_settings 
  ALTER COLUMN default_platform_margin_pct SET DEFAULT 0,
  ALTER COLUMN default_collection_fee_pct SET DEFAULT 0;

-- Reset existing settings row to 0 (admin will set them from UI)
UPDATE public.platform_settings
SET default_platform_margin_pct = 0,
    default_collection_fee_pct = 0;
