CREATE OR REPLACE FUNCTION public.enforce_order_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  caller_is_admin boolean;
  caller_is_vendor boolean;
  sh_status text;
  is_print_locked boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  caller_is_admin  := public.has_role(auth.uid(), 'admin'::app_role);
  caller_is_vendor := public.has_role(auth.uid(), 'vendor'::app_role);

  IF caller_is_admin OR caller_is_vendor THEN
    RETURN NEW;
  END IF;

  is_print_locked := (OLD.label_printed_at IS NOT NULL)
                     OR (NEW.label_printed_at IS NOT NULL)
                     OR (OLD.shipment_id IS NOT NULL)
                     OR (NEW.shipment_id IS NOT NULL);

  -- No printed label and no shipment yet → order is still editable by merchant.
  IF NOT is_print_locked THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.shipment_id, OLD.shipment_id) IS NOT NULL THEN
    SELECT status INTO sh_status
      FROM public.shipments
      WHERE id = COALESCE(NEW.shipment_id, OLD.shipment_id);
  END IF;

  -- After barcode/label print, block merchant changes to all operational fields.
  -- Allow only soft administrative fields that do not change courier liability.
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

CREATE OR REPLACE FUNCTION public.enforce_shipment_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  caller_is_admin boolean;
  caller_is_vendor boolean;
  linked_order_printed_at timestamptz;
  linked_order_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  caller_is_admin  := public.has_role(auth.uid(), 'admin'::app_role);
  caller_is_vendor := public.has_role(auth.uid(), 'vendor'::app_role);

  IF caller_is_admin OR caller_is_vendor THEN
    RETURN NEW;
  END IF;

  SELECT o.id, o.label_printed_at
    INTO linked_order_id, linked_order_printed_at
  FROM public.orders o
  WHERE o.shipment_id = OLD.id OR o.id = OLD.order_id
  LIMIT 1;

  -- A shipment becomes locked for merchants as soon as its barcode/label is printed.
  IF linked_order_printed_at IS NOT NULL THEN
    IF (NEW.receiver_name       IS DISTINCT FROM OLD.receiver_name)
    OR (NEW.phone_number        IS DISTINCT FROM OLD.phone_number)
    OR (NEW.city                IS DISTINCT FROM OLD.city)
    OR (NEW.detailed_address    IS DISTINCT FROM OLD.detailed_address)
    OR (NEW.cod_amount          IS DISTINCT FROM OLD.cod_amount)
    OR (NEW.courier_id          IS DISTINCT FROM OLD.courier_id)
    OR (NEW.tracking_number     IS DISTINCT FROM OLD.tracking_number)
    OR (NEW.order_id            IS DISTINCT FROM OLD.order_id)
    OR (NEW.shipping_fee        IS DISTINCT FROM OLD.shipping_fee)
    OR (NEW.carrier_fee         IS DISTINCT FROM OLD.carrier_fee)
    OR (NEW.platform_margin     IS DISTINCT FROM OLD.platform_margin)
    OR (NEW.collection_fee      IS DISTINCT FROM OLD.collection_fee)
    OR (NEW.merchant_shipping_fee IS DISTINCT FROM OLD.merchant_shipping_fee)
    OR (NEW.final_weight        IS DISTINCT FROM OLD.final_weight)
    OR (NEW.volumetric_weight   IS DISTINCT FROM OLD.volumetric_weight)
    OR (NEW.billable_weight     IS DISTINCT FROM OLD.billable_weight)
    OR (NEW.status              IS DISTINCT FROM OLD.status)
    THEN
      RAISE EXCEPTION 'SHIPMENT_LOCKED_AFTER_LABEL_PRINT: لا يمكن تعديل الشحنة بعد طباعة الباركود/البوليصة'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;