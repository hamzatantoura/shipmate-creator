
-- Create city enum
CREATE TYPE public.shipment_city AS ENUM ('Damascus', 'Aleppo', 'Homs', 'Lattakia', 'Hama', 'Tartous');

-- Create shipments table
CREATE TABLE public.shipments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  city shipment_city NOT NULL,
  detailed_address TEXT NOT NULL,
  cod_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  tracking_number TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Merchants can view own shipments" ON public.shipments FOR SELECT USING (auth.uid() = merchant_id);
CREATE POLICY "Merchants can create own shipments" ON public.shipments FOR INSERT WITH CHECK (auth.uid() = merchant_id);
CREATE POLICY "Merchants can update own shipments" ON public.shipments FOR UPDATE USING (auth.uid() = merchant_id);
CREATE POLICY "Merchants can delete own shipments" ON public.shipments FOR DELETE USING (auth.uid() = merchant_id);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_shipments_updated_at
BEFORE UPDATE ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
