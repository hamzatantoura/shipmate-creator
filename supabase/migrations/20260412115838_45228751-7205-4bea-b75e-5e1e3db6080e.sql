
-- Step 1: Add whatsapp_number to merchants
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS whatsapp_number text;

-- Step 2: Clean up duplicate provinces
-- For each duplicated province, keep the one with sub_regions and delete the other.
-- First, reassign sub_regions from empty duplicates if any, then delete duplicates.

-- Idlib: keep a6eb3255 (has 6 sub_regions), delete fdc5be58
DELETE FROM public.sub_regions WHERE province_id = 'fdc5be58-f930-4e16-b1c2-2c26061f0de2';
DELETE FROM public.provinces WHERE id = 'fdc5be58-f930-4e16-b1c2-2c26061f0de2';

-- Al-Hasakah: keep 638b2626 (has 5), delete bf682205
DELETE FROM public.sub_regions WHERE province_id = 'bf682205-bf2b-49a6-bd6f-cc40484954c5';
DELETE FROM public.provinces WHERE id = 'bf682205-bf2b-49a6-bd6f-cc40484954c5';

-- Ar-Raqqah: keep 5fb2711a (has 4), delete ab197985
DELETE FROM public.sub_regions WHERE province_id = 'ab197985-0384-43da-82c6-26fd68cb9359';
DELETE FROM public.provinces WHERE id = 'ab197985-0384-43da-82c6-26fd68cb9359';

-- As-Suwayda: keep c0523dcf (has 4), delete 087022a2
DELETE FROM public.sub_regions WHERE province_id = '087022a2-5878-4429-a856-42f7058f6c61';
DELETE FROM public.provinces WHERE id = '087022a2-5878-4429-a856-42f7058f6c61';

-- Quneitra: keep 4b64fdb2 (has 3), delete 6aa64847
DELETE FROM public.sub_regions WHERE province_id = '6aa64847-3f50-40f4-b5da-75b3b9adf49c';
DELETE FROM public.provinces WHERE id = '6aa64847-3f50-40f4-b5da-75b3b9adf49c';

-- Daraa: keep 0b796f36 (has 6), delete 15d752f6
DELETE FROM public.sub_regions WHERE province_id = '15d752f6-09ca-4b04-bc26-1be4662b8260';
DELETE FROM public.provinces WHERE id = '15d752f6-09ca-4b04-bc26-1be4662b8260';

-- Deir ez-Zor: keep ec1555a6 (has 4), delete dc2f6088
DELETE FROM public.sub_regions WHERE province_id = 'dc2f6088-d7d6-41d2-8a53-7660d7a90b7f';
DELETE FROM public.provinces WHERE id = 'dc2f6088-d7d6-41d2-8a53-7660d7a90b7f';

-- Rif Dimashq: keep 309dcb19 (has 18), delete c5a689d8
DELETE FROM public.sub_regions WHERE province_id = 'c5a689d8-3025-46d9-ac91-e6e05d3c3db7';
DELETE FROM public.provinces WHERE id = 'c5a689d8-3025-46d9-ac91-e6e05d3c3db7';

-- Step 3: Clean up duplicate districts (keep one per province_ar)
DELETE FROM public.districts a
USING public.districts b
WHERE a.id > b.id
  AND a.province_ar = b.province_ar
  AND a.area_ar IS NOT DISTINCT FROM b.area_ar;

-- Step 4: Add missing shipping zones for Sila Express (provinces not yet covered)
INSERT INTO public.shipping_zones (province_name, province_name_ar, delivery_fee, carrier_id, is_active)
SELECT v.name, v.name_ar, v.fee, 'a0000000-0000-0000-0000-000000000001', true
FROM (VALUES
  ('Idlib', 'إدلب', 20000),
  ('Daraa', 'درعا', 20000),
  ('As-Suwayda', 'السويداء', 20000),
  ('Quneitra', 'القنيطرة', 20000),
  ('Ar-Raqqah', 'الرقة', 25000),
  ('Deir-ez-Zor', 'دير الزور', 25000),
  ('Al-Hasakah', 'الحسكة', 25000),
  ('Rif-Dimashq', 'ريف دمشق', 15000)
) AS v(name, name_ar, fee)
WHERE NOT EXISTS (
  SELECT 1 FROM public.shipping_zones sz 
  WHERE sz.province_name_ar = v.name_ar 
    AND sz.area_name IS NULL 
    AND sz.neighborhood_name IS NULL
);
