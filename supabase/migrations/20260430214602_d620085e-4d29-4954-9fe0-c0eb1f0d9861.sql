-- Extend order_status mirror map in transition_shipment_status to cover the
-- courier-facing statuses used by CourierOrders.tsx (processing, shipped,
-- cancelled). Without these, the RPC succeeds but the linked order's status
-- is not mirrored, so the merchant view appears stale.
CREATE OR REPLACE FUNCTION public.transition_shipment_status(
  p_shipment_id uuid,
  p_new_status text,
  p_return_reason text DEFAULT NULL
)
RETURNS public.shipments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_shipment public.shipments;
  v_old_status text;
  v_is_admin boolean;
  v_is_vendor boolean;
  v_authorized boolean := false;
  v_order_status text;
  v_order_status_map jsonb := jsonb_build_object(
    'pending',              'pending',
    'processing',           'processing',
    'picked_up',            'processing',
    'at_warehouse',         'processing',
    'shipped',              'shipped',
    'in_transit_intercity', 'in_transit',
    'with_distributor',     'in_transit',
    'out_for_delivery',     'out_for_delivery',
    'delivered',            'delivered',
    'returned',             'returned',
    'cancelled',            'cancelled'
  );
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_shipment FROM public.shipments WHERE id = p_shipment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHIPMENT_NOT_FOUND: %', p_shipment_id USING ERRCODE = 'P0002';
  END IF;

  v_old_status := v_shipment.status;

  v_is_admin  := public.has_role(v_user, 'admin'::app_role);
  v_is_vendor := public.has_role(v_user, 'vendor'::app_role);

  IF v_is_admin THEN
    v_authorized := true;
  ELSIF v_is_vendor AND v_shipment.courier_id IS NOT NULL AND public.is_vendor_courier(v_shipment.courier_id) THEN
    v_authorized := true;
  END IF;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: only the assigned courier company or admin can transition this shipment'
      USING ERRCODE = '42501';
  END IF;

  IF p_new_status IS NULL OR length(trim(p_new_status)) = 0 THEN
    RAISE EXCEPTION 'INVALID_STATUS: status is required';
  END IF;

  IF p_new_status = 'returned' AND (p_return_reason IS NULL OR length(trim(p_return_reason)) = 0) THEN
    RAISE EXCEPTION 'RETURN_REASON_REQUIRED';
  END IF;

  UPDATE public.shipments
     SET status = p_new_status,
         updated_at = now()
   WHERE id = p_shipment_id
   RETURNING * INTO v_shipment;

  INSERT INTO public.shipment_status_history (shipment_id, old_status, new_status, changed_by)
  VALUES (p_shipment_id, v_old_status, p_new_status, v_user::text);

  v_order_status := v_order_status_map ->> p_new_status;
  IF v_order_status IS NOT NULL THEN
    UPDATE public.orders
       SET status = v_order_status,
           return_reason = CASE WHEN p_new_status = 'returned' THEN p_return_reason ELSE return_reason END,
           updated_at = now()
     WHERE shipment_id = p_shipment_id;
  END IF;

  RETURN v_shipment;
END;
$$;

REVOKE ALL ON FUNCTION public.transition_shipment_status(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_shipment_status(uuid, text, text) TO authenticated;