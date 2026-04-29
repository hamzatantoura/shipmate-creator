-- ==========================================================
-- STEP 11: Notifications table + trigger + realtime
-- ==========================================================

-- 1) Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  title       text NOT NULL,
  message     text NOT NULL,
  link        text,
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id) WHERE is_read = false;

-- 2) Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 3) Policies — users only see/update their own; no direct INSERT/DELETE.
DROP POLICY IF EXISTS "Users view own notifications"   ON public.notifications;
DROP POLICY IF EXISTS "Users mark own notifications read" ON public.notifications;

CREATE POLICY "Users view own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow only flipping is_read; block tampering with title/message/user_id by
-- requiring the WITH CHECK row to keep the same identity & content.
CREATE POLICY "Users mark own notifications read"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND user_id = (SELECT n.user_id  FROM public.notifications n WHERE n.id = notifications.id)
    AND title   = (SELECT n.title    FROM public.notifications n WHERE n.id = notifications.id)
    AND message = (SELECT n.message  FROM public.notifications n WHERE n.id = notifications.id)
  );

-- (No INSERT / DELETE policies → nobody can write directly.
--  Trigger functions are SECURITY DEFINER so they bypass RLS.)

-- 4) Notification builder for order status changes
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _terminal text[] := ARRAY['delivered', 'returned', 'cancelled', 'rejected'];
  _label    text;
  _short_id text;
  _title    text;
  _message  text;
BEGIN
  -- Only act on real status transitions to a terminal/important state
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

  -- Best-effort insert; never block the order update on notification failure
  BEGIN
    INSERT INTO public.notifications (user_id, title, message, link)
    VALUES (NEW.merchant_id, _title, _message, '/merchant/orders');
  EXCEPTION WHEN OTHERS THEN
    -- swallow any errors so legitimate order updates always succeed
    NULL;
  END;

  RETURN NEW;
END;
$function$;

-- 5) Trigger
DROP TRIGGER IF EXISTS trg_notify_order_status_change ON public.orders;
CREATE TRIGGER trg_notify_order_status_change
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_order_status_change();

-- 6) Enable realtime publication for notifications
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;