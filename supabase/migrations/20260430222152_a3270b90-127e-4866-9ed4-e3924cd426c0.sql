-- Fix the print-lock state machine so the first label-print operation can
-- atomically link the shipment and lock the order, while later merchant edits
-- remain blocked.

CREATE OR REPLACE FUNCTION public.enforce_order_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  caller_is_admin boolean;
  caller_is_vendor boolean;
  is_already_locked boolean;
  is_first_print_lock boolean;
  linked_shipment_order_id uuid;
  linked_shipment_merchant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  caller_is_admin  := public.has_role(auth.uid(), 'admin'::app_role);
  caller_is_vendor := public.has_role(auth.uid(), 'vendor'::app_role);

  IF caller_is_admin OR caller_is_vendor THEN
    RETURN NEW;
  END IF;

  is_already_locked := OLD.label_printed_at IS NOT NULL OR OLD.shipment_id IS NOT NULL;

  is_first_print_lock := NOT is_already_locked
    AND NEW.label_printed_at IS NOT NULL
    AND NEW.shipment_id IS NOT NULL
    AND NEW.status IN ('new', 'processing', 'pending')
    AND (NEW.receiver_name        IS NOT DISTINCT FROM OLD.receiver_name)
    AND (NEW.phone_number         IS NOT DISTINCT FROM OLD.phone_number)
    AND (NEW.city                 IS NOT DISTINCT FROM OLD.city)
    AND (NEW.detailed_address     IS NOT DISTINCT FROM OLD.detailed_address)
    AND (NEW.district_id          IS NOT DISTINCT FROM OLD.district_id)
    AND (NEW.courier_id           IS NOT DISTINCT FROM OLD.courier_id)
    AND (NEW.assigned_branch_id   IS NOT DISTINCT FROM OLD.assigned_branch_id)
    AND (NEW.product_id           IS NOT DISTINCT FROM OLD.product_id)
    AND (NEW.quantity             IS NOT DISTINCT FROM OLD.quantity)
    AND (NEW.total_amount         IS NOT DISTINCT FROM OLD.total_amount)
    AND (NEW.final_sale_price     IS NOT DISTINCT FROM OLD.final_sale_price)
    AND (NEW.delivery_fee         IS NOT DISTINCT FROM OLD.delivery_fee)
    AND (NEW.platform_fee         IS NOT DISTINCT FROM OLD.platform_fee)
    AND (NEW.net_amount           IS NOT DISTINCT FROM OLD.net_amount)
    AND (NEW.customer_lat         IS NOT DISTINCT FROM OLD.customer_lat)
    AND (NEW.customer_lng         IS NOT DISTINCT FROM OLD.customer_lng);

  IF is_first_print_lock THEN
    SELECT s.order_id, s.merchant_id
      INTO linked_shipment_order_id, linked_shipment_merchant_id
    FROM public.shipments s
    WHERE s.id = NEW.shipment_id;

    IF linked_shipment_order_id IS DISTINCT FROM OLD.id
       OR linked_shipment_merchant_id IS DISTINCT FROM OLD.merchant_id THEN
      RAISE EXCEPTION 'INVALID_SHIPMENT_LINK: الشحنة غير مرتبطة بهذا الطلب'
        USING ERRCODE = '42501';
    END IF;

    NEW.status := 'processing';
    RETURN NEW;
  END IF;

  IF NOT is_already_locked THEN
    RETURN NEW;
  END IF;

  IF (NEW.receiver_name        IS DISTINCT FROM OLD.receiver_name)
  OR (NEW.phone_number         IS DISTINCT FROM OLD.phone_number)
  OR (NEW.city                 IS DISTINCT FROM OLD.city)
  OR (NEW.detailed_address     IS DISTINCT FROM OLD.detailed_address)
  OR (NEW.district_id          IS DISTINCT FROM OLD.district_id)
  OR (NEW.courier_id           IS DISTINCT FROM OLD.courier_id)
  OR (NEW.assigned_branch_id   IS DISTINCT FROM OLD.assigned_branch_id)
  OR (NEW.product_id           IS DISTINCT FROM OLD.product_id)
  OR (NEW.quantity             IS DISTINCT FROM OLD.quantity)
  OR (NEW.total_amount         IS DISTINCT FROM OLD.total_amount)
  OR (NEW.final_sale_price     IS DISTINCT FROM OLD.final_sale_price)
  OR (NEW.delivery_fee         IS DISTINCT FROM OLD.delivery_fee)
  OR (NEW.platform_fee         IS DISTINCT FROM OLD.platform_fee)
  OR (NEW.net_amount           IS DISTINCT FROM OLD.net_amount)
  OR (NEW.customer_lat         IS DISTINCT FROM OLD.customer_lat)
  OR (NEW.customer_lng         IS DISTINCT FROM OLD.customer_lng)
  OR (NEW.shipment_id          IS DISTINCT FROM OLD.shipment_id)
  OR (NEW.label_printed_at     IS DISTINCT FROM OLD.label_printed_at)
  OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status NOT IN ('cancelled'))
  THEN
    RAISE EXCEPTION 'ORDER_LOCKED_AFTER_LABEL_PRINT: لا يمكن تعديل الطلب بعد طباعة الباركود/البوليصة'
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

CREATE OR REPLACE FUNCTION public.lock_order_after_label_print(
  p_order_id uuid,
  p_shipment_id uuid DEFAULT NULL::uuid
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_order public.orders;
  v_shipment public.shipments;
  v_shipment_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_order.merchant_id IS DISTINCT FROM v_user
     AND NOT public.has_role(v_user, 'admin'::app_role) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = '42501';
  END IF;

  IF v_order.status NOT IN ('new', 'processing', 'pending') THEN
    RAISE EXCEPTION 'يمكن طباعة البوليصة فقط للطلبات الجديدة أو قيد المعالجة' USING ERRCODE = '42501';
  END IF;

  IF p_shipment_id IS NOT NULL THEN
    SELECT * INTO v_shipment
    FROM public.shipments
    WHERE id = p_shipment_id
    FOR UPDATE;
  ELSE
    SELECT * INTO v_shipment
    FROM public.shipments
    WHERE order_id = p_order_id
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHIPMENT_NOT_FOUND_FOR_ORDER' USING ERRCODE = 'P0002';
  END IF;

  IF v_shipment.order_id IS DISTINCT FROM v_order.id
     OR v_shipment.merchant_id IS DISTINCT FROM v_order.merchant_id THEN
    RAISE EXCEPTION 'INVALID_SHIPMENT_LINK: الشحنة غير مرتبطة بهذا الطلب'
      USING ERRCODE = '42501';
  END IF;

  v_shipment_id := v_shipment.id;

  UPDATE public.orders
     SET label_printed_at = COALESCE(label_printed_at, now()),
         shipment_id = COALESCE(shipment_id, v_shipment_id),
         status = 'processing',
         updated_at = now()
   WHERE id = p_order_id
   RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

REVOKE ALL ON FUNCTION public.lock_order_after_label_print(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lock_order_after_label_print(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_shipment_status_to_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _order_status text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'pending' THEN _order_status := 'pending';
    WHEN 'received_by_courier' THEN _order_status := 'processing';
    WHEN 'processing' THEN _order_status := 'processing';
    WHEN 'picked_up' THEN _order_status := 'processing';
    WHEN 'at_warehouse' THEN _order_status := 'processing';
    WHEN 'in_transit_intercity' THEN _order_status := 'shipped';
    WHEN 'with_distributor' THEN _order_status := 'out_for_delivery';
    WHEN 'out_for_delivery' THEN _order_status := 'out_for_delivery';
    WHEN 'delivered' THEN _order_status := 'delivered';
    WHEN 'returned' THEN _order_status := 'returned';
    WHEN 'cancelled' THEN _order_status := 'cancelled';
    ELSE _order_status := NEW.status;
  END CASE;

  UPDATE public.orders
     SET status = _order_status,
         shipment_id = COALESCE(shipment_id, NEW.id),
         updated_at = now()
   WHERE shipment_id = NEW.id
      OR (NEW.order_id IS NOT NULL AND id = NEW.order_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_shipment_to_order ON public.shipments;
CREATE TRIGGER trg_sync_shipment_to_order
  AFTER UPDATE ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_shipment_status_to_order();

WITH latest_shipments AS (
  SELECT DISTINCT ON (sh.order_id)
    sh.order_id,
    sh.id AS shipment_id
  FROM public.shipments sh
  WHERE sh.order_id IS NOT NULL
  ORDER BY sh.order_id, sh.created_at DESC
)
UPDATE public.orders o
   SET shipment_id = ls.shipment_id,
       label_printed_at = COALESCE(o.label_printed_at, now()),
       status = CASE WHEN o.status IN ('new', 'pending') THEN 'processing' ELSE o.status END,
       updated_at = now()
  FROM latest_shipments ls
 WHERE o.id = ls.order_id
   AND o.shipment_id IS NULL
   AND o.label_printed_at IS NULL
   AND o.deleted_at IS NULL;