-- Merchants: origin province
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS province_id uuid REFERENCES public.provinces(id);

CREATE INDEX IF NOT EXISTS idx_merchants_province_id ON public.merchants(province_id);

-- Couriers: COD collection fee percentage
ALTER TABLE public.couriers
  ADD COLUMN IF NOT EXISTS cod_fee_percentage numeric NOT NULL DEFAULT 0.00;

-- Courier district rates: weight bands + ETA
ALTER TABLE public.courier_district_rates
  ADD COLUMN IF NOT EXISTS min_weight_kg numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_weight_kg numeric NOT NULL DEFAULT 999,
  ADD COLUMN IF NOT EXISTS estimated_days text;