-- 1) Restrict vendor SELECT visibility: hide draft orders from couriers/vendors
DROP POLICY IF EXISTS "orders_select_vendor_assigned" ON public.orders;
CREATE POLICY "orders_select_vendor_assigned"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'vendor'::app_role)
    AND courier_id IS NOT NULL
    AND is_vendor_courier(courier_id)
    AND status <> 'draft'
  );

DROP POLICY IF EXISTS "Courier company updates assigned orders" ON public.orders;
CREATE POLICY "Courier company updates assigned orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'vendor'::app_role)
    AND courier_id IS NOT NULL
    AND is_vendor_courier(courier_id)
    AND status <> 'draft'
  )
  WITH CHECK (
    has_role(auth.uid(), 'vendor'::app_role)
    AND courier_id IS NOT NULL
    AND is_vendor_courier(courier_id)
    AND status <> 'draft'
  );

-- 2) Server-side print-readiness validation
CREATE OR REPLACE FUNCTION public.validate_order_print_readiness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _digits text;
BEGIN
  -- Only enforce when label_printed_at transitions from NULL to a value
  IF OLD.label_printed_at IS NOT NULL OR NEW.label_printed_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'draft' THEN
    RAISE EXCEPTION 'لا يمكن طباعة بوليصة لطلب في وضع المسودة' USING ERRCODE = '42501';
  END IF;

  IF NEW.status NOT IN ('new', 'processing') THEN
    RAISE EXCEPTION 'يمكن طباعة البوليصة فقط للطلبات الجديدة أو قيد المعالجة' USING ERRCODE = '42501';
  END IF;

  IF NEW.district_id IS NULL THEN
    RAISE EXCEPTION 'يجب تحديد المنطقة قبل طباعة البوليصة' USING ERRCODE = '23502';
  END IF;

  _digits := regexp_replace(COALESCE(NEW.phone_number, ''), '\D', '', 'g');
  -- Strip a leading country code (963) or leading 00963 if present
  IF _digits LIKE '00963%' THEN
    _digits := substring(_digits FROM 6);
    _digits := '0' || _digits;
  ELSIF _digits LIKE '963%' AND length(_digits) >= 12 THEN
    _digits := '0' || substring(_digits FROM 4);
  END IF;

  IF length(_digits) <> 10 THEN
    RAISE EXCEPTION 'رقم هاتف المستلم يجب أن يكون 10 أرقام محلية' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_order_print_readiness ON public.orders;
CREATE TRIGGER trg_validate_order_print_readiness
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_print_readiness();

REVOKE EXECUTE ON FUNCTION public.validate_order_print_readiness() FROM PUBLIC, anon, authenticated;