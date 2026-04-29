CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _terminal text[] := ARRAY['delivered', 'returned', 'cancelled', 'rejected'];
  _wa_terminal text[] := ARRAY['delivered', 'returned'];
  _label    text;
  _wa_label text;
  _short_id text;
  _title    text;
  _message  text;
  _wa_msg   text;
  _review_url text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF NOT (NEW.status = ANY(_terminal)) THEN
    RETURN NEW;
  END IF;
  IF NEW.merchant_id IS NULL THEN
    RETURN NEW;
  END IF;

  _short_id := substring(NEW.id::text, 1, 6);

  _label := CASE NEW.status
    WHEN 'delivered' THEN 'مُسلَّم ✅'
    WHEN 'returned'  THEN 'مرتجع ↩️'
    WHEN 'cancelled' THEN 'ملغي ❌'
    WHEN 'rejected'  THEN 'مرفوض ⛔'
    ELSE NEW.status
  END;

  _title   := 'تحديث حالة الطلب';
  _message := 'تم تحديث حالة الطلب SL-' || upper(_short_id) || ' إلى ' || _label
              || ' — المستلم: ' || COALESCE(NEW.receiver_name, '');

  -- In-app merchant notification (best-effort)
  BEGIN
    INSERT INTO public.notifications (user_id, title, message, link)
    VALUES (NEW.merchant_id, _title, _message, '/merchant/orders');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- WhatsApp customer queue (only for delivered/returned, best-effort)
  IF NEW.status = ANY(_wa_terminal)
     AND NEW.phone_number IS NOT NULL
     AND length(btrim(NEW.phone_number)) > 0 THEN
    BEGIN
      _wa_label := CASE NEW.status
        WHEN 'delivered' THEN 'تم التسليم ✅'
        WHEN 'returned'  THEN 'تم الإرجاع ↩️'
      END;

      _wa_msg := 'مرحباً ' || COALESCE(NEW.receiver_name, 'عميلنا الكريم')
                 || '، تم تحديث طلبك رقم SL-' || upper(_short_id)
                 || ' إلى: ' || _wa_label
                 || E'.\nشكراً لاختيارك صلة.';

      IF NEW.status = 'delivered' THEN
        _review_url := 'https://sila-sy.com/review/' || NEW.id::text;
        _wa_msg := _wa_msg || E'\n\nنسعد بتقييمك عبر الرابط التالي:\n' || _review_url;
      END IF;

      INSERT INTO public.whatsapp_queue (order_id, phone_number, message, status)
      VALUES (NEW.id, NEW.phone_number, _wa_msg, 'pending');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$function$;