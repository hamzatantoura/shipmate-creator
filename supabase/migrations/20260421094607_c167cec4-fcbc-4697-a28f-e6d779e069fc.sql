ALTER TABLE public.couriers
  ADD COLUMN IF NOT EXISTS cod_fee_type text NOT NULL DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS cod_fee_value numeric NOT NULL DEFAULT 0;

ALTER TABLE public.couriers
  DROP CONSTRAINT IF EXISTS couriers_cod_fee_type_check;

ALTER TABLE public.couriers
  ADD CONSTRAINT couriers_cod_fee_type_check
  CHECK (cod_fee_type IN ('fixed', 'percentage'));