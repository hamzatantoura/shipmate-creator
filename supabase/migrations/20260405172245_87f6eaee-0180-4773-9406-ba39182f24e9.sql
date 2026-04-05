
-- Shipment status history log
CREATE TABLE public.shipment_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by TEXT DEFAULT 'system',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shipment_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_status_history" ON public.shipment_status_history
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE INDEX idx_status_history_shipment ON public.shipment_status_history(shipment_id);

-- Payout requests table
CREATE TABLE public.payout_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  method TEXT NOT NULL,
  account_details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  receipt_url TEXT,
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_payouts" ON public.payout_requests
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.shipment_status_history;
