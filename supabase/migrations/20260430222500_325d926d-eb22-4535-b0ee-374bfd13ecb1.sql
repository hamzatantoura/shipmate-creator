CREATE OR REPLACE FUNCTION public.prevent_merchant_status_spoof()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _restricted text[] := ARRAY[
    'received_by_courier',
    'shipped',
    'out_for_delivery',
    'delivered',
    'returned',
    'processing'
  ];
  _is_admin boolean;
  _is_vendor boolean;
  _is_first_print_lock boolean;
  _linked_order_id uuid;
  _linked_merchant_id uuid;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  _is_admin  := public.has_role(auth.uid(), 'admin'::app_role);
  _is_vendor := public.has_role(auth.uid(), 'vendor'::app_role);

  IF _is_admin OR _is_vendor THEN
    RETURN NEW;
  END IF;

  _is_first_print_lock := OLD.label_printed_at IS NULL
    AND OLD.shipment_id IS NULL
    AND NEW.label_printed_at IS NOT NULL
    AND NEW.shipment_id IS NOT NULL
    AND NEW.status = 'processing';

  IF _is_first_print_lock THEN
    SELECT s.order_id, s.merchant_id
      INTO _linked_order_id, _linked_merchant_id
    FROM public.shipments s
    WHERE s.id = NEW.shipment_id;

    IF _linked_order_id IS NOT DISTINCT FROM OLD.id
       AND _linked_merchant_id IS NOT DISTINCT FROM OLD.merchant_id THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.status = ANY(_restricted) THEN
    RAISE EXCEPTION 'لا يمكن للتاجر تعديل حالة الطلب إلى "%"؛ يتم ذلك تلقائياً عبر شركة الشحن.', NEW.status
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;