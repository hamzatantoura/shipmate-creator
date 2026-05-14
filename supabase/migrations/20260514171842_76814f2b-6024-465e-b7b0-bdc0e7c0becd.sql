
ALTER TABLE public.couriers
  ADD COLUMN IF NOT EXISTS return_fee_type text NOT NULL DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS return_fee_fixed numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_delivery_attempts integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS delivery_sla_hours integer NOT NULL DEFAULT 72,
  ADD COLUMN IF NOT EXISTS cod_collection_responsibility text NOT NULL DEFAULT 'merchant',
  ADD COLUMN IF NOT EXISTS policy_notes text;

ALTER TABLE public.couriers
  DROP CONSTRAINT IF EXISTS couriers_return_fee_type_check;
ALTER TABLE public.couriers
  ADD CONSTRAINT couriers_return_fee_type_check
  CHECK (return_fee_type IN ('percentage', 'fixed'));

ALTER TABLE public.couriers
  DROP CONSTRAINT IF EXISTS couriers_cod_collection_responsibility_check;
ALTER TABLE public.couriers
  ADD CONSTRAINT couriers_cod_collection_responsibility_check
  CHECK (cod_collection_responsibility IN ('merchant', 'courier_absorbs'));

ALTER TABLE public.couriers
  DROP CONSTRAINT IF EXISTS couriers_max_attempts_range;
ALTER TABLE public.couriers
  ADD CONSTRAINT couriers_max_attempts_range
  CHECK (max_delivery_attempts BETWEEN 1 AND 10);
