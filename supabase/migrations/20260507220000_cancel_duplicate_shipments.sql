-- Cleanup: cancel any duplicate/orphan shipments for orders already settled
UPDATE public.shipments s
SET status = 'cancelled', updated_at = now()
FROM public.orders o
WHERE s.order_id = o.id
  AND o.status IN ('delivered','returned','cancelled')
  AND (o.shipment_id IS NULL OR o.shipment_id <> s.id)
  AND s.status NOT IN ('delivered','returned','cancelled');

-- Trigger: when an order becomes delivered/returned/cancelled,
-- cancel any other shipments that share its order_id but are not the order's
-- current shipment_id. Prevents duplicate shipments from inflating expected balance.
CREATE OR REPLACE FUNCTION public.cancel_duplicate_shipments_on_order_settled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('delivered','returned','cancelled')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.shipments
    SET status = 'cancelled', updated_at = now()
    WHERE order_id = NEW.id
      AND (NEW.shipment_id IS NULL OR id <> NEW.shipment_id)
      AND status NOT IN ('delivered','returned','cancelled');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_duplicate_shipments ON public.orders;
CREATE TRIGGER trg_cancel_duplicate_shipments
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.cancel_duplicate_shipments_on_order_settled();
