
CREATE OR REPLACE FUNCTION public.auto_create_merchant_wallet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.wallets (merchant_id, balance)
    VALUES (NEW.user_id, 0)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_create_wallet
AFTER INSERT ON public.merchants
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_merchant_wallet();
