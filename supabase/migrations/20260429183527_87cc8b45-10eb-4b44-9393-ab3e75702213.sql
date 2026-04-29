-- 1) Drop the leaky anon INSERT policy on orders
DROP POLICY IF EXISTS "Anon can create orders for storefront" ON public.orders;

-- 2) Secure RPC for storefront checkout
CREATE OR REPLACE FUNCTION public.create_storefront_order(
  p_merchant_id   uuid,
  p_product_id    uuid,
  p_quantity      integer,
  p_district_id   uuid,
  p_receiver_name text,
  p_phone_number  text,
  p_detailed_address text,
  p_customer_lat  numeric DEFAULT NULL,
  p_customer_lng  numeric DEFAULT NULL,
  p_notes         text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _product       public.products%ROWTYPE;
  _merchant      public.merchants%ROWTYPE;
  _district      public.districts%ROWTYPE;
  _qty           integer;
  _unit_price    numeric;
  _subtotal      numeric;
  _raw_delivery  numeric;
  _delivery_fee  numeric;
  _platform_rate numeric;
  _platform_fee  numeric;
  _total_amount  numeric;
  _net_amount    numeric;
  _city_label    text;
  _free_shipping boolean;
  _new_id        uuid;
BEGIN
  -- ---- Input sanity ----
  IF p_merchant_id IS NULL OR p_product_id IS NULL OR p_district_id IS NULL THEN
    RAISE EXCEPTION 'بيانات الطلب ناقصة';
  END IF;

  _qty := COALESCE(p_quantity, 1);
  IF _qty <= 0 OR _qty > 1000 THEN
    RAISE EXCEPTION 'الكمية غير صالحة';
  END IF;

  IF p_receiver_name IS NULL OR length(btrim(p_receiver_name)) = 0 THEN
    RAISE EXCEPTION 'اسم المستلم مطلوب';
  END IF;
  IF p_phone_number IS NULL OR length(btrim(p_phone_number)) < 6 THEN
    RAISE EXCEPTION 'رقم الهاتف غير صالح';
  END IF;

  -- ---- Load product & verify ownership/status ----
  SELECT * INTO _product
  FROM public.products
  WHERE id = p_product_id
    AND merchant_id = p_merchant_id
    AND is_active = true
    AND deleted_at IS NULL
  LIMIT 1;

  IF _product.id IS NULL THEN
    RAISE EXCEPTION 'المنتج غير متاح';
  END IF;

  -- ---- Load merchant & verify status ----
  SELECT * INTO _merchant
  FROM public.merchants
  WHERE user_id = p_merchant_id
    AND is_active = true
    AND verification_status = 'verified'
  LIMIT 1;

  IF _merchant.user_id IS NULL THEN
    RAISE EXCEPTION 'المتجر غير متاح حالياً';
  END IF;

  -- ---- Load district ----
  SELECT * INTO _district
  FROM public.districts
  WHERE id = p_district_id
    AND is_active = true
  LIMIT 1;

  IF _district.id IS NULL THEN
    RAISE EXCEPTION 'المنطقة غير متاحة';
  END IF;

  -- ---- Server-side pricing (zero client trust) ----
  _unit_price   := COALESCE(_product.price, 0);
  _subtotal     := _unit_price * _qty;
  _raw_delivery := COALESCE(_district.delivery_fee, 0);

  _free_shipping :=
    _merchant.shipping_policy = 'free_all'
    OR (
      _merchant.shipping_policy = 'free_above'
      AND COALESCE(_merchant.free_shipping_threshold, 0) > 0
      AND _subtotal >= _merchant.free_shipping_threshold
    );

  _delivery_fee  := CASE WHEN _free_shipping THEN 0 ELSE _raw_delivery END;
  _platform_rate := COALESCE(_merchant.platform_fee_rate, 0.05);
  _platform_fee  := round(_subtotal * _platform_rate, 2);
  _total_amount  := _subtotal;
  _net_amount    := _subtotal - _delivery_fee - _platform_fee;

  _city_label := COALESCE(_district.province_ar, _district.province, '');

  -- ---- Insert order with status forced to 'new' ----
  INSERT INTO public.orders (
    merchant_id, product_id, quantity,
    total_amount, delivery_fee, platform_fee, net_amount,
    receiver_name, phone_number, city, detailed_address,
    district_id, customer_lat, customer_lng,
    notes, status
  ) VALUES (
    p_merchant_id, _product.id, _qty,
    _total_amount, _delivery_fee, _platform_fee, _net_amount,
    btrim(p_receiver_name), btrim(p_phone_number), _city_label,
    COALESCE(NULLIF(btrim(p_detailed_address), ''), 'غير محدد'),
    _district.id, p_customer_lat, p_customer_lng,
    NULLIF(btrim(p_notes), ''), 'new'
  )
  RETURNING id INTO _new_id;

  RETURN jsonb_build_object(
    'order_id',     _new_id,
    'total_amount', _total_amount,
    'delivery_fee', _delivery_fee,
    'platform_fee', _platform_fee,
    'net_amount',   _net_amount
  );
END;
$$;

-- 3) Grant execute to anon + authenticated (storefront is public)
REVOKE ALL ON FUNCTION public.create_storefront_order(uuid,uuid,integer,uuid,text,text,text,numeric,numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_storefront_order(uuid,uuid,integer,uuid,text,text,text,numeric,numeric,text) TO anon, authenticated;
