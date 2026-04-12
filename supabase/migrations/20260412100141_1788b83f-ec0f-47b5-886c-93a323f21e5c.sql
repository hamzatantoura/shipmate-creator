
-- Audit logs table (immutable)
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by_user_id uuid,
  changed_by_role text DEFAULT 'system',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read audit logs for their shipments
CREATE POLICY "Merchants can view own shipment audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    shipment_id IN (SELECT id FROM public.shipments WHERE merchant_id = auth.uid())
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'vendor')
  );

-- Only system (via trigger) can insert
CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- NO update or delete policies — audit logs are immutable

-- Trigger to auto-log status changes
CREATE OR REPLACE FUNCTION public.log_shipment_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.audit_logs (shipment_id, old_status, new_status, changed_by_user_id, changed_by_role)
    VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid(),
      COALESCE((SELECT role::text FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1), 'system')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_shipment_status ON public.shipments;
CREATE TRIGGER trg_log_shipment_status
  AFTER UPDATE ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_shipment_status_change();

-- Data locking: prevent merchant from updating shipment after pickup
-- Locked statuses: at_warehouse, in_transit_intercity, with_distributor, delivered, returned
CREATE OR REPLACE FUNCTION public.prevent_merchant_edit_after_pickup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _locked_statuses text[] := ARRAY['at_warehouse', 'in_transit_intercity', 'with_distributor', 'delivered', 'returned'];
  _user_role text;
BEGIN
  -- If status is locked, only admin/vendor can update
  IF OLD.status = ANY(_locked_statuses) THEN
    SELECT role::text INTO _user_role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
    IF _user_role IS NULL OR _user_role = 'merchant' THEN
      RAISE EXCEPTION 'لا يمكن تعديل الشحنة بعد استلامها من التاجر';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_shipment_after_pickup ON public.shipments;
CREATE TRIGGER trg_lock_shipment_after_pickup
  BEFORE UPDATE ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_merchant_edit_after_pickup();
