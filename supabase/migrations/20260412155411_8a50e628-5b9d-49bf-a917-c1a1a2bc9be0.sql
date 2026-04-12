
-- Drop existing triggers to avoid conflicts
DROP TRIGGER IF EXISTS trg_sync_shipment_to_order ON public.shipments;
DROP TRIGGER IF EXISTS trg_shipment_wallet_settlement ON public.shipments;
DROP TRIGGER IF EXISTS trg_log_shipment_status ON public.shipments;
DROP TRIGGER IF EXISTS trg_prevent_merchant_edit ON public.shipments;

-- 1. Sync function
CREATE OR REPLACE FUNCTION public.sync_shipment_status_to_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _order_status text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'pending' THEN _order_status := 'processing';
    WHEN 'picked_up' THEN _order_status := 'shipped';
    WHEN 'at_warehouse' THEN _order_status := 'shipped';
    WHEN 'in_transit_intercity' THEN _order_status := 'shipped';
    WHEN 'with_distributor' THEN _order_status := 'out_for_delivery';
    WHEN 'out_for_delivery' THEN _order_status := 'out_for_delivery';
    WHEN 'delivered' THEN _order_status := 'delivered';
    WHEN 'returned' THEN _order_status := 'returned';
    ELSE _order_status := NEW.status;
  END CASE;

  UPDATE public.orders
  SET status = _order_status, updated_at = now()
  WHERE shipment_id = NEW.id;

  RETURN NEW;
END;
$$;

-- Create all triggers
CREATE TRIGGER trg_prevent_merchant_edit
  BEFORE UPDATE ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_merchant_edit_after_pickup();

CREATE TRIGGER trg_sync_shipment_to_order
  AFTER UPDATE ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_shipment_status_to_order();

CREATE TRIGGER trg_shipment_wallet_settlement
  AFTER UPDATE ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_shipment_wallet_settlement();

CREATE TRIGGER trg_log_shipment_status
  AFTER UPDATE ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_shipment_status_change();
