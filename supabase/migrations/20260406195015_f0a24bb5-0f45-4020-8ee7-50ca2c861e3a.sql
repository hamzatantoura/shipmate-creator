
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'merchant', 'vendor');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  role app_role NOT NULL DEFAULT 'merchant',
  store_name TEXT,
  contact_person TEXT,
  phone TEXT,
  city TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles without recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to get user role from profiles
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- Profiles RLS
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin');

-- user_roles RLS
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, role)
  VALUES (NEW.id, COALESCE(
    (NEW.raw_user_meta_data->>'role')::app_role,
    'merchant'
  ));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE(
    (NEW.raw_user_meta_data->>'role')::app_role,
    'merchant'
  ));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update shipments RLS to use auth
DROP POLICY IF EXISTS "Allow anon to insert shipments" ON public.shipments;
DROP POLICY IF EXISTS "Allow anon to select shipments" ON public.shipments;
DROP POLICY IF EXISTS "Allow anon to update shipments" ON public.shipments;
DROP POLICY IF EXISTS "Merchants can delete own shipments" ON public.shipments;

CREATE POLICY "Merchants can insert own shipments"
ON public.shipments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = merchant_id);

CREATE POLICY "Merchants can view own shipments"
ON public.shipments FOR SELECT
TO authenticated
USING (
  auth.uid() = merchant_id
  OR public.get_user_role(auth.uid()) = 'admin'
  OR (public.get_user_role(auth.uid()) = 'vendor' AND carrier_id IN (
    SELECT id FROM public.carriers WHERE id = carrier_id
  ))
);

CREATE POLICY "Admin and vendor can update shipments"
ON public.shipments FOR UPDATE
TO authenticated
USING (
  public.get_user_role(auth.uid()) = 'admin'
  OR public.get_user_role(auth.uid()) = 'vendor'
  OR auth.uid() = merchant_id
);

-- Update wallets RLS
DROP POLICY IF EXISTS "anon_all_wallets" ON public.wallets;
CREATE POLICY "Merchants can manage own wallet"
ON public.wallets FOR ALL
TO authenticated
USING (auth.uid() = merchant_id);

CREATE POLICY "Admins can view all wallets"
ON public.wallets FOR SELECT
TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin');

-- Trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Also keep anon select on shipments for public tracking
CREATE POLICY "Public can track shipments by tracking number"
ON public.shipments FOR SELECT
TO anon
USING (tracking_number IS NOT NULL);
