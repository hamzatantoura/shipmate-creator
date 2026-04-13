CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '24 hours'
);

ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access" ON public.email_verification_tokens
  FOR ALL TO authenticated USING (false);