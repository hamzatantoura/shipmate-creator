
-- Carriers table
CREATE TABLE public.carriers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  base_rate NUMERIC NOT NULL DEFAULT 0,
  per_kg_rate NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.carriers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_carriers" ON public.carriers FOR SELECT TO anon USING (true);

-- Seed carriers
INSERT INTO public.carriers (name, name_ar, base_rate, per_kg_rate) VALUES
  ('Qadam', 'قدم', 5000, 1000),
  ('Al-Wajeeh', 'الوجيه', 4500, 1200),
  ('Express Syria', 'إكسبرس سوريا', 6000, 800);

-- Products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_products" ON public.products FOR ALL TO anon USING (true) WITH CHECK (true);

-- Orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity INT NOT NULL DEFAULT 1,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  receiver_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  city TEXT NOT NULL,
  detailed_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  shipment_id UUID REFERENCES public.shipments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_orders" ON public.orders FOR ALL TO anon USING (true) WITH CHECK (true);

-- Wallets table
CREATE TABLE public.wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL UNIQUE,
  balance NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_wallets" ON public.wallets FOR ALL TO anon USING (true) WITH CHECK (true);

-- Seed a default wallet for our test merchant
INSERT INTO public.wallets (merchant_id, balance) VALUES ('00000000-0000-0000-0000-000000000000', 0);

-- Wallet transactions
CREATE TABLE public.wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'topup', 'shipping_fee', 'cod_settlement', 'commission', 'carrier_adjustment'
  amount NUMERIC NOT NULL,
  description TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_wallet_txns" ON public.wallet_transactions FOR ALL TO anon USING (true) WITH CHECK (true);

-- Top-up requests
CREATE TABLE public.top_up_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  method TEXT NOT NULL, -- 'shamcash', 'syriatel_cash', 'manual_transfer'
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.top_up_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_topup" ON public.top_up_requests FOR ALL TO anon USING (true) WITH CHECK (true);

-- Add carrier & weight fields to shipments
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS carrier_id UUID REFERENCES public.carriers(id),
  ADD COLUMN IF NOT EXISTS final_weight NUMERIC DEFAULT 1,
  ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS order_id UUID;

-- Storage bucket for receipts and product images
INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', true);
CREATE POLICY "Anyone can upload" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'uploads');
CREATE POLICY "Anyone can view uploads" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'uploads');
