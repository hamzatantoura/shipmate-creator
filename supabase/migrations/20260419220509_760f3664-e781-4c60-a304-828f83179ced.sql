ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS label_printed_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_orders_label_printed_at ON public.orders(label_printed_at);