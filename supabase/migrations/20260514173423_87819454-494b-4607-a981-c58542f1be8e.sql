
-- Bulk import jobs table
CREATE TABLE public.bulk_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  file_name text NOT NULL,
  total_rows integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'processing', -- processing | completed | failed
  errors jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{ row, message, data }]
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_bulk_import_jobs_merchant ON public.bulk_import_jobs(merchant_id, created_at DESC);

ALTER TABLE public.bulk_import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants insert own import jobs"
  ON public.bulk_import_jobs FOR INSERT TO authenticated
  WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "Merchants update own import jobs"
  ON public.bulk_import_jobs FOR UPDATE TO authenticated
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "Merchants view own import jobs"
  ON public.bulk_import_jobs FOR SELECT TO authenticated
  USING (merchant_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete import jobs"
  ON public.bulk_import_jobs FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add configurable settings to platform_settings (admin-managed, no hardcoded defaults in code)
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS bulk_import_max_rows integer NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS bulk_import_required_fields jsonb NOT NULL DEFAULT
    '["receiver_name","phone_number","province","detailed_address","cod_amount"]'::jsonb;
