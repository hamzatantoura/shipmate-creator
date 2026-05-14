
-- 1. Add columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS needs_onboarding boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auth_provider text NOT NULL DEFAULT 'email';

-- 2. Update the new-user trigger to handle Google OAuth signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.app_role;
  v_provider text;
  v_is_oauth boolean;
  v_has_signup_data boolean;
BEGIN
  -- Detect provider from auth metadata
  v_provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
  v_is_oauth := v_provider <> 'email';

  -- Did the signup form supply merchant data? (email signup populates these)
  v_has_signup_data := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'store_name','') IS NOT NULL
    OR NULLIF(NEW.raw_user_meta_data->>'role','') IS NOT NULL,
    false
  );

  IF v_is_oauth AND NOT v_has_signup_data THEN
    -- Google (or other OAuth) user: create a stub profile only.
    -- They must finish onboarding at /complete-profile before getting a role.
    INSERT INTO public.profiles (user_id, role, needs_onboarding, auth_provider)
    VALUES (NEW.id, 'merchant'::public.app_role, true, v_provider)
    ON CONFLICT (user_id) DO UPDATE
      SET needs_onboarding = EXCLUDED.needs_onboarding,
          auth_provider   = EXCLUDED.auth_provider;
    -- Intentionally NO insert into user_roles or merchants here.
    RETURN NEW;
  END IF;

  -- Standard email signup path (unchanged behaviour)
  v_role := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'role','')::public.app_role,
    'merchant'::public.app_role
  );

  INSERT INTO public.profiles (user_id, role, contact_person, phone, auth_provider, needs_onboarding)
  VALUES (
    NEW.id,
    v_role,
    NEW.raw_user_meta_data->>'contact_person',
    NEW.raw_user_meta_data->>'phone',
    v_provider,
    false
  )
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF v_role = 'merchant' THEN
    INSERT INTO public.merchants (user_id, store_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'store_name',''))
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
