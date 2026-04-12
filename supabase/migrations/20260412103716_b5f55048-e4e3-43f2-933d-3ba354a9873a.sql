-- Add notes column to shipments table
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS notes text DEFAULT NULL;