-- Admin notifications when merchants sign up or become ready for review.
-- Inserts one notification row per admin (user_roles.role='admin').

CREATE OR REPLACE FUNCTION public.notify_admins_of_merchant_event(
  _title text,
  _message text,
  _link text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, link)
  SELECT ur.user_id, _title, _message, _link
  FROM public.user_roles ur
  WHERE ur.role = 'admin';
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_merchant_admin_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_admins_of_merchant_event(
      'تاجر جديد بانتظار التحقق',
      COALESCE(NULLIF(NEW.store_name, ''), 'متجر جديد') || ' — سجّل للتو وبدأ بإكمال البيانات.',
      '/admin?tab=merchants'
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.verification_status = 'pending_admin_approval'
       AND COALESCE(OLD.verification_status, '') <> 'pending_admin_approval' THEN
      PERFORM public.notify_admins_of_merchant_event(
        'تاجر جاهز للاعتماد',
        COALESCE(NULLIF(NEW.store_name, ''), 'تاجر') || ' — أكمل بياناته وينتظر مراجعتك.',
        '/admin?tab=merchants'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_merchant_admin_notify_ins ON public.merchants;
CREATE TRIGGER trg_merchant_admin_notify_ins
AFTER INSERT ON public.merchants
FOR EACH ROW EXECUTE FUNCTION public.handle_merchant_admin_notify();

DROP TRIGGER IF EXISTS trg_merchant_admin_notify_upd ON public.merchants;
CREATE TRIGGER trg_merchant_admin_notify_upd
AFTER UPDATE OF verification_status ON public.merchants
FOR EACH ROW EXECUTE FUNCTION public.handle_merchant_admin_notify();