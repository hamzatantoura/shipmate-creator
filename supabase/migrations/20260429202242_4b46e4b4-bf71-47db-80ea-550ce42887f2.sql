-- 1) Reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL,
  courier_id uuid,
  product_id uuid,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  reviewer_role text NOT NULL DEFAULT 'customer' CHECK (reviewer_role IN ('customer','merchant')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Indexes for common reads
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.reviews (product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_courier_id ON public.reviews (courier_id);
CREATE INDEX IF NOT EXISTS idx_reviews_merchant_id ON public.reviews (merchant_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_desc ON public.reviews (created_at DESC);

-- 3) RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Public can view reviews for active, non-deleted products
DROP POLICY IF EXISTS "Public view active product reviews" ON public.reviews;
CREATE POLICY "Public view active product reviews"
  ON public.reviews FOR SELECT TO anon, authenticated
  USING (
    product_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = reviews.product_id
        AND p.is_active = true
        AND p.deleted_at IS NULL
    )
  );

-- Merchants view reviews for their own orders
DROP POLICY IF EXISTS "Merchants view own reviews" ON public.reviews;
CREATE POLICY "Merchants view own reviews"
  ON public.reviews FOR SELECT TO authenticated
  USING (merchant_id = auth.uid());

-- Vendors view reviews for their courier's orders
DROP POLICY IF EXISTS "Vendors view courier reviews" ON public.reviews;
CREATE POLICY "Vendors view courier reviews"
  ON public.reviews FOR SELECT TO authenticated
  USING (
    courier_id IS NOT NULL
    AND public.has_role(auth.uid(), 'vendor'::app_role)
    AND public.is_vendor_courier(courier_id)
  );

-- Admins see everything
DROP POLICY IF EXISTS "Admins view all reviews" ON public.reviews;
CREATE POLICY "Admins view all reviews"
  ON public.reviews FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage reviews" ON public.reviews;
CREATE POLICY "Admins manage reviews"
  ON public.reviews FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- No INSERT/UPDATE policies — writes go through the SECURITY DEFINER RPC below

-- 4) Public review lookup RPC (for /review/:order_id page)
CREATE OR REPLACE FUNCTION public.get_review_context(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _order RECORD;
  _product_name text;
  _courier_name text;
  _has_review boolean;
BEGIN
  SELECT o.id, o.status, o.receiver_name, o.product_id, o.courier_id, o.merchant_id
    INTO _order
  FROM public.orders o
  WHERE o.id = p_order_id AND o.deleted_at IS NULL
  LIMIT 1;

  IF _order.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF _order.status NOT IN ('delivered','returned') THEN
    RETURN jsonb_build_object('error', 'not_eligible');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.reviews WHERE order_id = _order.id) INTO _has_review;

  IF _order.product_id IS NOT NULL THEN
    SELECT name INTO _product_name FROM public.products WHERE id = _order.product_id;
  END IF;
  IF _order.courier_id IS NOT NULL THEN
    SELECT name INTO _courier_name FROM public.couriers WHERE id = _order.courier_id;
  END IF;

  RETURN jsonb_build_object(
    'order_id', _order.id,
    'sila_code', 'SL-' || upper(substring(_order.id::text, 1, 6)),
    'receiver_name', _order.receiver_name,
    'product_name', _product_name,
    'courier_name', _courier_name,
    'already_reviewed', _has_review
  );
END;
$function$;

-- 5) Public review submission RPC
CREATE OR REPLACE FUNCTION public.submit_order_review(
  p_order_id uuid,
  p_rating integer,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _order RECORD;
  _clean_comment text;
BEGIN
  -- Validate rating
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'التقييم يجب أن يكون بين 1 و 5' USING ERRCODE = '22023';
  END IF;

  -- Sanitize comment: trim + cap at 1000 chars
  _clean_comment := NULLIF(btrim(COALESCE(p_comment, '')), '');
  IF _clean_comment IS NOT NULL AND length(_clean_comment) > 1000 THEN
    _clean_comment := substring(_clean_comment, 1, 1000);
  END IF;

  -- Load order
  SELECT id, status, merchant_id, courier_id, product_id
    INTO _order
  FROM public.orders
  WHERE id = p_order_id AND deleted_at IS NULL
  LIMIT 1;

  IF _order.id IS NULL THEN
    RAISE EXCEPTION 'الطلب غير موجود' USING ERRCODE = '02000';
  END IF;

  IF _order.status NOT IN ('delivered','returned') THEN
    RAISE EXCEPTION 'لا يمكن تقييم طلب قبل تسليمه' USING ERRCODE = '42501';
  END IF;

  -- Insert (UNIQUE on order_id prevents double-review)
  BEGIN
    INSERT INTO public.reviews (order_id, merchant_id, courier_id, product_id,
                                rating, comment, reviewer_role)
    VALUES (_order.id, _order.merchant_id, _order.courier_id, _order.product_id,
            p_rating, _clean_comment, 'customer');
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'تم تقييم هذا الطلب مسبقاً' USING ERRCODE = '23505';
  END;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- 6) Allow anonymous + authenticated callers to invoke the public RPCs
REVOKE ALL ON FUNCTION public.get_review_context(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_order_review(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_review_context(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_order_review(uuid, integer, text) TO anon, authenticated;