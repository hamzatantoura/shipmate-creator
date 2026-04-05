
-- Provinces table
CREATE TABLE public.provinces (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  name_ar text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.provinces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_provinces" ON public.provinces FOR SELECT TO anon USING (true);

-- Sub-regions table
CREATE TABLE public.sub_regions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  province_id uuid NOT NULL REFERENCES public.provinces(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_ar text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sub_regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_sub_regions" ON public.sub_regions FOR SELECT TO anon USING (true);

-- Carrier coverage and pricing per province
CREATE TABLE public.carrier_coverage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  carrier_id uuid NOT NULL REFERENCES public.carriers(id) ON DELETE CASCADE,
  province_id uuid NOT NULL REFERENCES public.provinces(id) ON DELETE CASCADE,
  intra_city_rate numeric NOT NULL DEFAULT 10000,
  inter_city_rate numeric NOT NULL DEFAULT 25000,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(carrier_id, province_id)
);
ALTER TABLE public.carrier_coverage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_carrier_coverage" ON public.carrier_coverage FOR SELECT TO anon USING (true);

-- Insert provinces
INSERT INTO public.provinces (name, name_ar) VALUES
  ('Damascus', 'دمشق'),
  ('Rif Dimashq', 'ريف دمشق'),
  ('Aleppo', 'حلب'),
  ('Homs', 'حمص'),
  ('Hama', 'حماة'),
  ('Lattakia', 'اللاذقية'),
  ('Tartous', 'طرطوس'),
  ('Deir ez-Zor', 'دير الزور'),
  ('Idlib', 'إدلب'),
  ('Daraa', 'درعا'),
  ('Al-Suwayda', 'السويداء'),
  ('Al-Hasakah', 'الحسكة'),
  ('Ar-Raqqah', 'الرقة'),
  ('Quneitra', 'القنيطرة');

-- Sub-regions for Damascus
INSERT INTO public.sub_regions (province_id, name, name_ar)
SELECT p.id, s.name, s.name_ar
FROM public.provinces p,
(VALUES
  ('Mazzeh', 'المزة'), ('Kafr Souseh', 'كفرسوسة'), ('Mashrou Dummar', 'مشروع دمر'),
  ('Al-Midan', 'الميدان'), ('Bab Touma', 'باب توما'), ('Al-Salhiyeh', 'الصالحية'),
  ('Malki', 'المالكي'), ('Abu Romaneh', 'أبو رمانة'), ('Jaramana', 'جرمانا'),
  ('Sahnaya', 'صحنايا'), ('Qudsaya', 'قدسيا'), ('Al-Hameh', 'الهامة')
) AS s(name, name_ar)
WHERE p.name = 'Damascus';

-- Sub-regions for Aleppo
INSERT INTO public.sub_regions (province_id, name, name_ar)
SELECT p.id, s.name, s.name_ar
FROM public.provinces p,
(VALUES
  ('Al-Aziziyeh', 'العزيزية'), ('Al-Jamiliyeh', 'الجميلية'), ('Al-Sulaymaniyeh', 'السليمانية'),
  ('Saif al-Dawla', 'سيف الدولة'), ('Al-Hamdaniyeh', 'الحمدانية'), ('Salah al-Din', 'صلاح الدين')
) AS s(name, name_ar)
WHERE p.name = 'Aleppo';

-- Sub-regions for Homs
INSERT INTO public.sub_regions (province_id, name, name_ar)
SELECT p.id, s.name, s.name_ar
FROM public.provinces p,
(VALUES
  ('Al-Waer', 'الوعر'), ('Bab Amr', 'باب عمرو'), ('Al-Inshaat', 'الإنشاءات'),
  ('Al-Hamidiyeh', 'الحميدية'), ('Akrama', 'عكرمة')
) AS s(name, name_ar)
WHERE p.name = 'Homs';

-- Sub-regions for Lattakia
INSERT INTO public.sub_regions (province_id, name, name_ar)
SELECT p.id, s.name, s.name_ar
FROM public.provinces p,
(VALUES
  ('Al-Raml', 'الرمل'), ('Al-Ziraa', 'الزراعة'), ('Al-American', 'الأمريكان'),
  ('Al-Salibeh', 'الصليبة')
) AS s(name, name_ar)
WHERE p.name = 'Lattakia';

-- Sub-regions for Hama
INSERT INTO public.sub_regions (province_id, name, name_ar)
SELECT p.id, s.name, s.name_ar
FROM public.provinces p,
(VALUES
  ('Al-Hader', 'الحاضر'), ('Al-Sabouniyeh', 'الصابونية'), ('Al-Hamidiyeh', 'الحميدية')
) AS s(name, name_ar)
WHERE p.name = 'Hama';

-- Sub-regions for Tartous
INSERT INTO public.sub_regions (province_id, name, name_ar)
SELECT p.id, s.name, s.name_ar
FROM public.provinces p,
(VALUES
  ('Al-Corniche', 'الكورنيش'), ('Al-Thawra', 'الثورة'), ('Al-Mina', 'الميناء')
) AS s(name, name_ar)
WHERE p.name = 'Tartous';

-- Sub-regions for Rif Dimashq
INSERT INTO public.sub_regions (province_id, name, name_ar)
SELECT p.id, s.name, s.name_ar
FROM public.provinces p,
(VALUES
  ('Darayya', 'داريا'), ('Moadamiyeh', 'المعضمية'), ('Zabadani', 'الزبداني'),
  ('Yabroud', 'يبرود'), ('Douma', 'دوما'), ('Harasta', 'حرستا')
) AS s(name, name_ar)
WHERE p.name = 'Rif Dimashq';
