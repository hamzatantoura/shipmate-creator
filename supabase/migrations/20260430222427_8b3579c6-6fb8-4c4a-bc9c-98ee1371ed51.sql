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
  OR (NEW.status               IS DISTINCT FROM OLD.status)
  THEN
    RAISE EXCEPTION 'ORDER_LOCKED_AFTER_LABEL_PRINT: لا يمكن تعديل أو إلغاء الطلب بعد طباعة الباركود/البوليصة'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;