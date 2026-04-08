
-- 1. Districts table (Syrian provinces & areas with delivery rates)
CREATE TABLE IF NOT EXISTS public.districts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  province TEXT NOT NULL,
  province_ar TEXT NOT NULL,
  area TEXT,
  area_ar TEXT,
  delivery_fee NUMERIC NOT NULL DEFAULT 15000,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view districts" ON public.districts FOR SELECT USING (true);

-- Insert Syrian provinces
INSERT INTO public.districts (province, province_ar, delivery_fee) VALUES
  ('Damascus', 'دمشق', 10000),
  ('Rural Damascus', 'ريف دمشق', 15000),
  ('Aleppo', 'حلب', 12000),
  ('Homs', 'حمص', 15000),
  ('Hama', 'حماة', 15000),
  ('Lattakia', 'اللاذقية', 18000),
  ('Tartous', 'طرطوس', 18000),
  ('Deir ez-Zor', 'دير الزور', 25000),
  ('Al-Hasakah', 'الحسكة', 25000),
  ('Raqqa', 'الرقة', 25000),
  ('Daraa', 'درعا', 20000),
  ('As-Suwayda', 'السويداء', 20000),
  ('Idlib', 'إدلب', 22000),
  ('Quneitra', 'القنيطرة', 20000);

-- 2. Merchants table
CREATE TABLE IF NOT EXISTS public.merchants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  store_name TEXT NOT NULL DEFAULT '',
  contact_person TEXT,
  phone TEXT,
  city TEXT,
  wallet_balance NUMERIC NOT NULL DEFAULT 0,
  platform_fee_rate NUMERIC NOT NULL DEFAULT 0.05,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants view own record" ON public.merchants FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Merchants update own record" ON public.merchants FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert merchants" ON public.merchants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. Add user_id to couriers for auth linking
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE;
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC NOT NULL DEFAULT 0;

-- 4. Add new columns to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS courier_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.districts(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS platform_fee NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS net_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS notes TEXT;

-- Update default status
ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'new';

-- 5. RLS for orders - courier sees assigned orders
CREATE POLICY "Couriers view assigned orders" ON public.orders FOR SELECT TO authenticated
  USING (courier_id::text = auth.uid()::text AND has_role(auth.uid(), 'vendor'));

CREATE POLICY "Couriers update assigned orders" ON public.orders FOR UPDATE TO authenticated
  USING (courier_id::text = auth.uid()::text AND has_role(auth.uid(), 'vendor'));

-- 6. Update handle_new_user to also create merchant record
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _role app_role;
BEGIN
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'merchant');
  
  INSERT INTO public.profiles (user_id, role, store_name, contact_person, phone, city)
  VALUES (
    NEW.id, _role,
    NEW.raw_user_meta_data->>'store_name',
    NEW.raw_user_meta_data->>'contact_person',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'city'
  );
  
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);
  
  -- Auto-create merchant record
  IF _role = 'merchant' THEN
    INSERT INTO public.merchants (user_id, store_name, contact_person, phone, city)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'store_name', ''),
      NEW.raw_user_meta_data->>'contact_person',
      NEW.raw_user_meta_data->>'phone',
      NEW.raw_user_meta_data->>'city'
    );
  END IF;
  
  -- Auto-create courier record if vendor/courier role
  IF _role = 'vendor' THEN
    INSERT INTO public.couriers (user_id, vendor_id, name, phone, city)
    VALUES (
      NEW.id, NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'contact_person', ''),
      NEW.raw_user_meta_data->>'phone',
      NEW.raw_user_meta_data->>'city'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 7. Trigger for updated_at on merchants
CREATE TRIGGER update_merchants_updated_at
BEFORE UPDATE ON public.merchants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
