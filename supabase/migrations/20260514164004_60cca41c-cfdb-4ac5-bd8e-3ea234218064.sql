
ALTER TABLE public.profiles DISABLE TRIGGER USER;

DELETE FROM public.user_roles ur
WHERE ur.role = 'merchant'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur2
    WHERE ur2.user_id = ur.user_id
      AND ur2.role IN ('vendor','admin')
  );

DELETE FROM public.user_roles ur
USING public.user_roles ur2
WHERE ur.user_id = ur2.user_id
  AND ur.id <> ur2.id
  AND (
    (ur.role = 'merchant' AND ur2.role IN ('admin','vendor'))
    OR (ur.role = 'vendor' AND ur2.role = 'admin')
  );

UPDATE public.profiles p
SET role = ur.role
FROM public.user_roles ur
WHERE ur.user_id = p.user_id
  AND p.role <> ur.role;

ALTER TABLE public.profiles ENABLE TRIGGER USER;

ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_user_id_key;
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.app_role;
BEGIN
  v_role := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'role','')::public.app_role,
    'merchant'::public.app_role
  );

  INSERT INTO public.profiles (user_id, role, contact_person, phone)
  VALUES (
    NEW.id,
    v_role,
    NEW.raw_user_meta_data->>'contact_person',
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

  IF v_role = 'merchant' THEN
    INSERT INTO public.merchants (user_id, store_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'store_name',''))
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
