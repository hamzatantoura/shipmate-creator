CREATE OR REPLACE FUNCTION public.prevent_merchant_edit_locked_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin boolean;
  _is_vendor boolean;
BEGIN
  -- Only enforce when the order is locked (label has been printed)
  IF OLD.label_printed_at IS NULL THEN
    RETURN NEW;
  END IF;

  _is_admin := public.has_role(auth.uid(), 'admin'::app_role);
  _is_vendor := public.has_role(auth.uid(), 'vendor'::app_role);

  -- Admins and vendors bypass the lock
  IF _is_admin OR _is_vendor THEN
    RETURN NEW;
  END IF;

  -- For merchants: allow ONLY status / courier_id / shipment_id / notes updates;
  -- block any change to customer/address/financial fields.
  IF NEW.receiver_name IS DISTINCT FROM OLD.receiver_name
     OR NEW.phone_number IS DISTINCT FROM OLD.phone_number
     OR NEW.city IS DISTINCT FROM OLD.city
     OR NEW.detailed_address IS DISTINCT FROM OLD.detailed_address
     OR NEW.district_id IS DISTINCT FROM OLD.district_id
     OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
     OR NEW.final_sale_price IS DISTINCT FROM OLD.final_sale_price
     OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
     OR NEW.product_id IS DISTINCT FROM OLD.product_id
     OR NEW.quantity IS DISTINCT FROM OLD.quantity
     OR NEW.customer_lat IS DISTINCT FROM OLD.customer_lat
     OR NEW.customer_lng IS DISTINCT FROM OLD.customer_lng
     OR NEW.label_printed_at IS DISTINCT FROM OLD.label_printed_at
  THEN
    RAISE EXCEPTION 'لا يمكن تعديل الطلب بعد طباعة البوليصة';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_merchant_edit_locked_order ON public.orders;
CREATE TRIGGER trg_prevent_merchant_edit_locked_order
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.prevent_merchant_edit_locked_order();