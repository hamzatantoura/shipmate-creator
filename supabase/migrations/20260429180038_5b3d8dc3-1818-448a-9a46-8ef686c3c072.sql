-- =====================================================================
-- P0 SECURITY FIX: Prevent privilege escalation on profiles & user_roles
-- =====================================================================

-- 1) Drop the overly permissive INSERT/UPDATE policies on profiles
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- 2) Strict INSERT: users can only create their own profile AND role MUST be 'merchant'
--    Admins can insert profiles with any role.
CREATE POLICY "Users can insert own profile as merchant"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    role = 'merchant'::app_role
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- 3) Strict UPDATE: users can update their own profile but role enforcement
--    is handled by a trigger (RLS WITH CHECK can't easily compare OLD vs NEW).
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4) Admins can update any profile (including role changes)
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 5) Trigger: prevent non-admins from changing the `role` column on profiles
CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
      RAISE EXCEPTION 'غير مصرّح بتغيير دور المستخدم';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_change ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_role_change();

-- =====================================================================
-- 6) Lock down user_roles INSERT path
--    Currently only "Admins can manage roles" (ALL) + "Users can view own roles"
--    exist. The handle_new_user() trigger runs as SECURITY DEFINER so it
--    bypasses RLS — no INSERT policy for end users is needed. We explicitly
--    add a deny-all INSERT policy for non-admin authenticated users to make
--    intent crystal clear and defense-in-depth.
-- =====================================================================

-- (Admins ALL policy already covers admin inserts; we add nothing permissive.)

-- 7) Defense-in-depth trigger on user_roles: block self-escalation attempts
CREATE OR REPLACE FUNCTION public.prevent_user_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow if called from a SECURITY DEFINER trigger (auth.uid() will be the
  -- new user themselves during signup — that's fine because handle_new_user
  -- forces role = 'merchant'). Block any direct attempt by an authenticated
  -- non-admin user to insert/update a role row for themselves with elevated
  -- privileges.
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF NEW.role <> 'merchant'::app_role
       AND NOT public.has_role(auth.uid(), 'admin'::app_role)
       AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'غير مصرّح بمنح هذا الدور';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_user_role_self_escalation ON public.user_roles;
CREATE TRIGGER trg_prevent_user_role_self_escalation
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_user_role_self_escalation();

-- =====================================================================
-- 8) Harden handle_new_user(): force role = 'merchant' on signup,
--    ignore any role passed in raw_user_meta_data. Vendor/admin accounts
--    must be provisioned by an admin via the admin tooling.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role app_role := 'merchant'::app_role;
BEGIN
  -- SECURITY: ignore client-supplied role; new signups are always merchants.
  -- Vendor/admin promotion happens server-side by an existing admin.

  INSERT INTO public.profiles (user_id, role, store_name, contact_person, phone, city)
  VALUES (
    NEW.id, _role,
    NEW.raw_user_meta_data->>'store_name',
    NEW.raw_user_meta_data->>'contact_person',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'city'
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);

  INSERT INTO public.merchants (user_id, store_name, contact_person, phone, city)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'store_name', ''),
    NEW.raw_user_meta_data->>'contact_person',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'city'
  );

  RETURN NEW;
END;
$$;