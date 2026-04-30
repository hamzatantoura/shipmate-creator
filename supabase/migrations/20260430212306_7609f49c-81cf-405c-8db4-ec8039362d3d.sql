
-- Lock shipments and orders once the courier has taken physical custody.
-- Once a shipment moves beyond 'pending' (e.g., picked_up by the carrier),
-- the merchant must NOT be able to modify the shipment record or its
-- linked order's mutable fields. Admins and the assigned vendor remain
-- free to update status as the package moves through the network.

CREATE OR REPLACE FUNCTION public.enforce_shipment_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean;
  caller_is_vendor boolean;
BEGIN
  -- Bypass for system / no-auth contexts (triggers fired by SECURITY DEFINER fns)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  caller_is_admin  := public.has_role(auth.uid(), 'admin'::app_role);
  caller_is_vendor := public.has_role(auth.uid(), 'vendor'::app_role);

  -- Admins and vendors can always update (vendor RLS still restricts to assigned)
  IF caller_is_admin OR caller_is_vendor THEN
    RETURN NEW;
  END IF;

  -- Merchant updates: only allowed while shipment is still 'pending'
  -- (i.e., not yet picked up by the courier).
  IF OLD.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'SHIPMENT_LOCKED: لا يمكن تعديل الشحنة بعد استلامها من شركة الشحن'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_shipment_lock ON public.shipments;
CREATE TRIGGER trg_enforce_shipment_lock
BEFORE UPDATE ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.enforce_shipment_lock();


-- Lock the linked order's mutable fields once its shipment is no longer 'pending'.
-- Allow the merchant to update soft fields like notes/deleted_at (archive),
-- but block changes to address/receiver/courier/status once locked.
CREATE OR REPLACE FUNCTION public.enforce_order_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean;
  caller_is_vendor boolean;
  sh_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  caller_is_admin  := public.has_role(auth.uid(), 'admin'::app_role);
  caller_is_vendor := public.has_role(auth.uid(), 'vendor'::app_role);

  IF caller_is_admin OR caller_is_vendor THEN
    RETURN NEW;
  END IF;

  -- No shipment yet → order is fully editable by the merchant
  IF NEW.shipment_id IS NULL AND OLD.shipment_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status INTO sh_status
    FROM public.shipments
    WHERE id = COALESCE(NEW.shipment_id, OLD.shipment_id);

  -- Shipment still pending → still editable
  IF sh_status IS NULL OR sh_status = 'pending' THEN
    RETURN NEW;
  END IF;

  -- Shipment is locked: only allow changes to soft fields
  IF (NEW.receiver_name   IS DISTINCT FROM OLD.receiver_name)
  OR (NEW.phone_number    IS DISTINCT FROM OLD.phone_number)
  OR (NEW.city            IS DISTINCT FROM OLD.city)
  OR (NEW.detailed_address IS DISTINCT FROM OLD.detailed_address)
  OR (NEW.district_id     IS DISTINCT FROM OLD.district_id)
  OR (NEW.courier_id      IS DISTINCT FROM OLD.courier_id)
  OR (NEW.assigned_branch_id IS DISTINCT FROM OLD.assigned_branch_id)
  OR (NEW.product_id      IS DISTINCT FROM OLD.product_id)
  OR (NEW.quantity        IS DISTINCT FROM OLD.quantity)
  OR (NEW.total_amount    IS DISTINCT FROM OLD.total_amount)
  OR (NEW.shipment_id     IS DISTINCT FROM OLD.shipment_id)
  OR (NEW.status          IS DISTINCT FROM OLD.status AND NEW.status NOT IN ('cancelled'))
  THEN
    RAISE EXCEPTION 'ORDER_LOCKED: لا يمكن تعديل الطلب بعد استلام الشحنة من شركة الشحن'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_lock ON public.orders;
CREATE TRIGGER trg_enforce_order_lock
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_order_lock();
