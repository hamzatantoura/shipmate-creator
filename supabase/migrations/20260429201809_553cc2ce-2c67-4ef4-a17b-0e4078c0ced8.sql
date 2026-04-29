-- 1) Status enum
DO $$ BEGIN
  CREATE TYPE public.whatsapp_status AS ENUM ('pending', 'sent', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Queue table
CREATE TABLE IF NOT EXISTS public.whatsapp_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  message text NOT NULL,
  status public.whatsapp_status NOT NULL DEFAULT 'pending',
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Indexes for queue processing & monitoring
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_status_created
  ON public.whatsapp_queue (status, created_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_created_desc
  ON public.whatsapp_queue (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_pending
  ON public.whatsapp_queue (created_at)
  WHERE status = 'pending';

-- 4) updated_at trigger
DROP TRIGGER IF EXISTS trg_whatsapp_queue_updated_at ON public.whatsapp_queue;
CREATE TRIGGER trg_whatsapp_queue_updated_at
BEFORE UPDATE ON public.whatsapp_queue
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) RLS — admins only
ALTER TABLE public.whatsapp_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view whatsapp queue" ON public.whatsapp_queue;
CREATE POLICY "Admins view whatsapp queue"
  ON public.whatsapp_queue FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins update whatsapp queue" ON public.whatsapp_queue;
CREATE POLICY "Admins update whatsapp queue"
  ON public.whatsapp_queue FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins delete whatsapp queue" ON public.whatsapp_queue;
CREATE POLICY "Admins delete whatsapp queue"
  ON public.whatsapp_queue FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
-- No INSERT policy: only SECURITY DEFINER triggers/functions write to this table.

-- 6) Update order status trigger to also enqueue WhatsApp customer notifications
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

      INSERT INTO public.whatsapp_queue (order_id, phone_number, message, status)
      VALUES (NEW.id, NEW.phone_number, _wa_msg, 'pending');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$function$;

-- Trigger already exists from prior migration; no need to recreate.