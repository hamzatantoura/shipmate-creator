
-- Add verification fields to merchants
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending_verification',
  ADD COLUMN IF NOT EXISTS id_image_url text,
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_confirmed boolean NOT NULL DEFAULT false;

-- Create index for filtering by verification status
CREATE INDEX IF NOT EXISTS idx_merchants_verification_status ON public.merchants(verification_status);

-- Update the anon SELECT policy to only show verified & active merchants
DROP POLICY IF EXISTS "Public can view active merchant info" ON public.merchants;
CREATE POLICY "Public can view verified active merchant info"
  ON public.merchants FOR SELECT TO anon
  USING (is_active = true AND verification_status = 'verified');
