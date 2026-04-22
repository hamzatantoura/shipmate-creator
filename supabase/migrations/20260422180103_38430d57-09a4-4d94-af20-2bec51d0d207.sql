-- Courier settlements: payments couriers report to Sila for COD they collected
CREATE TABLE public.courier_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reference text,
  notes text,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  receipt_url text,
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_courier_settlements_courier ON public.courier_settlements(courier_id);
CREATE INDEX idx_courier_settlements_status ON public.courier_settlements(status);

ALTER TABLE public.courier_settlements ENABLE ROW LEVEL SECURITY;

-- Vendors (couriers) can view their own settlements
CREATE POLICY "Vendors view own settlements"
ON public.courier_settlements FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'vendor'::app_role) AND is_vendor_courier(courier_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Vendors create their own settlement reports
CREATE POLICY "Vendors create own settlements"
ON public.courier_settlements FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'vendor'::app_role) AND is_vendor_courier(courier_id)
);

-- Admins update (approve/reject) settlements
CREATE POLICY "Admins update settlements"
ON public.courier_settlements FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins delete
CREATE POLICY "Admins delete settlements"
ON public.courier_settlements FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_courier_settlements_updated_at
BEFORE UPDATE ON public.courier_settlements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();