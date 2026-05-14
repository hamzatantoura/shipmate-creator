
CREATE OR REPLACE FUNCTION public.complete_merchant_onboarding(
  p_store_name text,
  p_contact_person text,
  p_phone text,
  p_city text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_needs boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Only allow if the user is actually flagged as needing onboarding
  SELECT needs_onboarding INTO v_needs
  FROM public.profiles WHERE user_id = v_uid;

  IF NOT COALESCE(v_needs, false) THEN
    RAISE EXCEPTION 'onboarding_not_required';
  END IF;

  -- Basic validation
  IF coalesce(trim(p_store_name),'') = '' OR coalesce(trim(p_contact_person),'') = ''
     OR coalesce(trim(p_phone),'') = '' OR coalesce(trim(p_city),'') = '' THEN
    RAISE EXCEPTION 'missing_required_fields';
  END IF;

  -- 1. Update profile
  UPDATE public.profiles
     SET store_name       = p_store_name,
         contact_person   = p_contact_person,
         phone            = p_phone,
         city             = p_city,
         role             = 'merchant'::public.app_role,
         needs_onboarding = false,
         updated_at       = now()
   WHERE user_id = v_uid;

  -- 2. Grant merchant role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'merchant'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 3. Create merchants record (pending admin approval)
  INSERT INTO public.merchants (
    user_id, store_name, contact_person, phone, city,
    email_confirmed, verification_status
  )
  VALUES (
    v_uid, p_store_name, p_contact_person, p_phone, p_city,
    true, 'pending_admin_approval'
  )
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_merchant_onboarding(text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_merchant_onboarding(text,text,text,text) TO authenticated;
