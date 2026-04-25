-- 1) Couriers: per-courier return fee percentage
ALTER TABLE public.couriers
  ADD COLUMN IF NOT EXISTS return_fee_percentage numeric NOT NULL DEFAULT 50;

-- 2) Platform settings: flat margin amount (in addition to percentage)
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS default_platform_margin_flat numeric NOT NULL DEFAULT 0;

-- 3) Update wallet credit trigger to use dynamic return percentage
CREATE OR REPLACE FUNCTION public.handle_courier_wallet_credit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _carrier_fee numeric;
  _return_pct numeric;
  _final_statuses text[] := ARRAY['delivered','returned','cancelled'];
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  IF OLD.status = ANY(_final_statuses) THEN
    RETURN NEW;
  END IF;
  IF NEW.courier_id IS NULL THEN
    RETURN NEW;
  END IF;

  _carrier_fee := COALESCE(NEW.carrier_fee, 0);
  IF _carrier_fee <= 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'delivered' THEN
    UPDATE public.couriers
      SET wallet_balance = wallet_balance + _carrier_fee
      WHERE id = NEW.courier_id;
  ELSIF NEW.status = 'returned' THEN
    SELECT COALESCE(return_fee_percentage, 50) INTO _return_pct
      FROM public.couriers WHERE id = NEW.courier_id;
    UPDATE public.couriers
      SET wallet_balance = wallet_balance + (_carrier_fee * (COALESCE(_return_pct, 50) / 100.0))
      WHERE id = NEW.courier_id;
  END IF;

  RETURN NEW;
END;
$function$;