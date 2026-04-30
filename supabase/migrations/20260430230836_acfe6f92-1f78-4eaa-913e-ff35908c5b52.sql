
-- ============================================================
-- 1) enforce_order_lock: يسمح بأول قفل، ويتجاهل تحديثات النظام
-- ============================================================
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
  from_system text;
BEGIN
  -- التحديثات القادمة من تريغر مزامنة الشحنة → اسمح بها مباشرة
  from_system := current_setting('app.from_shipment_sync', true);
  IF from_system = '1' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    -- لا يوجد سياق مستخدم → عملية نظامية، اسمح
    RETURN NEW;
  END IF;

  caller_is_admin  := public.has_role(auth.uid(), 'admin'::app_role);
  caller_is_vendor := public.has_role(auth.uid(), 'vendor'::app_role);

  IF caller_is_admin OR caller_is_vendor THEN
    RETURN NEW;
  END IF;

  is_already_locked := OLD.label_printed_at IS NOT NULL;

  -- القفل الأول: انتقال label_printed_at من NULL → قيمة
  -- shipment_id يجب أن يكون موجوداً (مرتبطاً مسبقاً أو يُربط الآن)
  is_first_print_lock := NOT is_already_locked
    AND NEW.label_printed_at IS NOT NULL
    AND NEW.shipment_id IS NOT NULL;

  IF is_first_print_lock THEN
    -- نضمن أن الحالة تنتقل إلى processing
    NEW.status := 'processing';
    RETURN NEW;
  END IF;

  -- إن لم يكن مقفولاً بعد، اسمح بالتعديلات الطبيعية للتاجر
  IF NOT is_already_locked THEN
    -- لكن لا نسمح للتاجر بضبط label_printed_at دون shipment_id
    IF NEW.label_printed_at IS NOT NULL AND NEW.shipment_id IS NULL THEN
      RAISE EXCEPTION 'CANNOT_PRINT_WITHOUT_SHIPMENT: لا يمكن طباعة البوليصة قبل إنشاء الشحنة'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- مقفول مسبقاً: نسمح فقط بالإلغاء (cancelled) إن لم يكن قد بدأ النقل
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
  THEN
    RAISE EXCEPTION 'ORDER_LOCKED_AFTER_LABEL_PRINT: لا يمكن تعديل الطلب بعد طباعة الباركود/البوليصة'
      USING ERRCODE = '42501';
  END IF;

  -- تغيير الحالة بعد القفل: مسموح فقط cancelled، ومسموح فقط قبل received_by_courier
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'cancelled' AND OLD.status IN ('new', 'pending', 'processing') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'ORDER_LOCKED_AFTER_LABEL_PRINT: لا يمكن تغيير حالة الطلب بعد طباعة البوليصة'
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

-- ============================================================
-- 2) prevent_merchant_status_spoof: يحترم علم النظام
-- ============================================================
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
    'returned'
  ];
  _is_admin boolean;
  _is_vendor boolean;
  from_system text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  from_system := current_setting('app.from_shipment_sync', true);
  IF from_system = '1' THEN
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

  -- التاجر يحاول تعيين حالة محظورة
  IF NEW.status = ANY(_restricted) THEN
    RAISE EXCEPTION 'لا يمكن للتاجر تعديل حالة الطلب إلى "%"؛ يتم ذلك تلقائياً عبر شركة الشحن.', NEW.status
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 3) sync_shipment_status_to_order: يضع علم النظام أثناء التحديث
-- ============================================================
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

  -- ضع العلم لتمرير enforce_order_lock + prevent_merchant_status_spoof
  PERFORM set_config('app.from_shipment_sync', '1', true);

  UPDATE public.orders
     SET status = _order_status,
         shipment_id = COALESCE(shipment_id, NEW.id),
         updated_at = now()
   WHERE shipment_id = NEW.id
      OR (NEW.order_id IS NOT NULL AND id = NEW.order_id);

  PERFORM set_config('app.from_shipment_sync', '', true);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_shipment_to_order ON public.shipments;
CREATE TRIGGER trg_sync_shipment_to_order
  AFTER UPDATE ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_shipment_status_to_order();

-- ============================================================
-- 4) auto_link_shipment_to_order: يربط orders.shipment_id تلقائياً
--    عند إنشاء/تحديث شحنة بـorder_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_link_shipment_to_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.order_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('app.from_shipment_sync', '1', true);

  UPDATE public.orders
     SET shipment_id = NEW.id,
         courier_id  = COALESCE(courier_id, NEW.courier_id),
         updated_at  = now()
   WHERE id = NEW.order_id
     AND (shipment_id IS DISTINCT FROM NEW.id);

  PERFORM set_config('app.from_shipment_sync', '', true);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_shipment_to_order ON public.shipments;
CREATE TRIGGER trg_auto_link_shipment_to_order
  AFTER INSERT OR UPDATE OF order_id ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_shipment_to_order();
