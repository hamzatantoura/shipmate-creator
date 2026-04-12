
-- 1. Add shipping policy columns to merchants
ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS shipping_policy text NOT NULL DEFAULT 'customer_pays',
ADD COLUMN IF NOT EXISTS free_shipping_threshold numeric NOT NULL DEFAULT 0;

-- 2. Add SELECT policy for authenticated users on provinces
CREATE POLICY "Authenticated can view provinces"
ON public.provinces FOR SELECT TO authenticated
USING (true);

-- 3. Add SELECT policy for authenticated users on sub_regions
CREATE POLICY "Authenticated can view sub_regions"
ON public.sub_regions FOR SELECT TO authenticated
USING (true);

-- 4. Insert missing provinces (skip existing ones)
INSERT INTO public.provinces (name, name_ar) VALUES
('Rif Dimashq', 'ريف دمشق'),
('Idlib', 'إدلب'),
('Daraa', 'درعا'),
('As-Suwayda', 'السويداء'),
('Quneitra', 'القنيطرة'),
('Ar-Raqqah', 'الرقة'),
('Deir ez-Zor', 'دير الزور'),
('Al-Hasakah', 'الحسكة')
ON CONFLICT DO NOTHING;

-- 5. Insert sub_regions for all provinces
-- We need province IDs, so use a CTE approach
DO $$
DECLARE
  pid uuid;
BEGIN
  -- Damascus
  SELECT id INTO pid FROM public.provinces WHERE name_ar = 'دمشق' LIMIT 1;
  IF pid IS NOT NULL THEN
    INSERT INTO public.sub_regions (province_id, name, name_ar) VALUES
    (pid, 'Mazzeh', 'المزة'), (pid, 'Malki', 'المالكي'), (pid, 'Abu Rummaneh', 'أبو رمانة'),
    (pid, 'Kafr Souseh', 'كفرسوسة'), (pid, 'Midan', 'الميدان'), (pid, 'Shaghour', 'الشاغور'),
    (pid, 'Bab Touma', 'باب توما'), (pid, 'Qassa', 'القصاع'), (pid, 'Muhajirin', 'المهاجرين'),
    (pid, 'Ruken al-Din', 'ركن الدين'), (pid, 'Barzeh', 'برزة'), (pid, 'Qaboun', 'القابون'),
    (pid, 'Jobar', 'جوبر'), (pid, 'Dummar', 'دمر'), (pid, 'Mashrou Dummar', 'مشروع دمر'),
    (pid, 'Mezzeh 86', 'مزة 86'), (pid, 'Darayya', 'داريا'), (pid, 'Sarouja', 'الصالحية'),
    (pid, 'Tijara', 'التجارة'), (pid, 'Baramkeh', 'البرامكة')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Aleppo
  SELECT id INTO pid FROM public.provinces WHERE name_ar = 'حلب' LIMIT 1;
  IF pid IS NOT NULL THEN
    INSERT INTO public.sub_regions (province_id, name, name_ar) VALUES
    (pid, 'Aziziyeh', 'العزيزية'), (pid, 'Sulaymaniyeh', 'السليمانية'), (pid, 'Shahba', 'شهبا'),
    (pid, 'Hamdaniyeh', 'الحمدانية'), (pid, 'Furqan', 'الفرقان'), (pid, 'Saif al-Dawla', 'سيف الدولة'),
    (pid, 'Midan', 'الميدان'), (pid, 'Jamiliyeh', 'الجميلية'), (pid, 'Mogambo', 'موغامبو'),
    (pid, 'New Aleppo', 'حلب الجديدة'), (pid, 'Salah al-Din', 'صلاح الدين'), (pid, 'Ashrafiyeh', 'الأشرفية'),
    (pid, 'Sheikh Maqsoud', 'الشيخ مقصود'), (pid, 'Sabeel', 'السبيل'), (pid, 'Villat', 'الفيلات')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Homs
  SELECT id INTO pid FROM public.provinces WHERE name_ar = 'حمص' LIMIT 1;
  IF pid IS NOT NULL THEN
    INSERT INTO public.sub_regions (province_id, name, name_ar) VALUES
    (pid, 'Inshaat', 'الإنشاءات'), (pid, 'Waer', 'الوعر'), (pid, 'Karam al-Shami', 'كرم الشامي'),
    (pid, 'Zahra', 'الزهراء'), (pid, 'Ghouta', 'الغوطة'), (pid, 'Bab al-Sibaa', 'باب السباع'),
    (pid, 'Hamidiyeh', 'الحميدية'), (pid, 'Akrama', 'عكرمة'), (pid, 'Bab Hood', 'باب هود'),
    (pid, 'Khaldiyeh', 'الخالدية')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Hama
  SELECT id INTO pid FROM public.provinces WHERE name_ar = 'حماة' LIMIT 1;
  IF pid IS NOT NULL THEN
    INSERT INTO public.sub_regions (province_id, name, name_ar) VALUES
    (pid, 'City Center', 'وسط المدينة'), (pid, 'Kazo', 'كازو'), (pid, 'Sabouniyeh', 'الصابونية'),
    (pid, 'Baath', 'البعث'), (pid, 'Hadir', 'الحاضر'), (pid, 'Qamhana', 'قمحانة'),
    (pid, 'Masyaf', 'مصياف'), (pid, 'Salamiyeh', 'سلمية')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Lattakia
  SELECT id INTO pid FROM public.provinces WHERE name_ar = 'اللاذقية' LIMIT 1;
  IF pid IS NOT NULL THEN
    INSERT INTO public.sub_regions (province_id, name, name_ar) VALUES
    (pid, 'Corniche', 'الكورنيش'), (pid, 'Ziraah', 'الزراعة'), (pid, 'American Street', 'الشارع الأمريكي'),
    (pid, 'Salibeh', 'الصليبة'), (pid, 'Raml', 'الرمل الشمالي'), (pid, 'Mashrou Zirai', 'المشروع الزراعي'),
    (pid, 'Tabiyat', 'التابيات'), (pid, 'Jableh', 'جبلة'), (pid, 'Qardaha', 'القرداحة')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Tartous
  SELECT id INTO pid FROM public.provinces WHERE name_ar = 'طرطوس' LIMIT 1;
  IF pid IS NOT NULL THEN
    INSERT INTO public.sub_regions (province_id, name, name_ar) VALUES
    (pid, 'Corniche', 'الكورنيش'), (pid, 'City Center', 'وسط المدينة'), (pid, 'Baniyas', 'بانياس'),
    (pid, 'Safita', 'صافيتا'), (pid, 'Duraykish', 'الدريكيش'), (pid, 'Mashta al-Helu', 'مشتى الحلو'),
    (pid, 'Sheikh Badr', 'الشيخ بدر')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Rif Dimashq
  SELECT id INTO pid FROM public.provinces WHERE name_ar = 'ريف دمشق' LIMIT 1;
  IF pid IS NOT NULL THEN
    INSERT INTO public.sub_regions (province_id, name, name_ar) VALUES
    (pid, 'Jaramana', 'جرمانا'), (pid, 'Sayyida Zeinab', 'السيدة زينب'), (pid, 'Qudsaya', 'قدسيا'),
    (pid, 'Zabadani', 'الزبداني'), (pid, 'Yabroud', 'يبرود'), (pid, 'Douma', 'دوما'),
    (pid, 'Harasta', 'حرستا'), (pid, 'Daraya', 'داريا'), (pid, 'Muadamiyeh', 'المعضمية'),
    (pid, 'Sahnaya', 'صحنايا'), (pid, 'Kisweh', 'الكسوة'), (pid, 'Artuz', 'عرطوز')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Idlib
  SELECT id INTO pid FROM public.provinces WHERE name_ar = 'إدلب' LIMIT 1;
  IF pid IS NOT NULL THEN
    INSERT INTO public.sub_regions (province_id, name, name_ar) VALUES
    (pid, 'City Center', 'وسط المدينة'), (pid, 'Maarat al-Numan', 'معرة النعمان'),
    (pid, 'Jisr al-Shughur', 'جسر الشغور'), (pid, 'Ariha', 'أريحا'), (pid, 'Saraqib', 'سراقب'),
    (pid, 'Kafr Nabl', 'كفرنبل')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Daraa
  SELECT id INTO pid FROM public.provinces WHERE name_ar = 'درعا' LIMIT 1;
  IF pid IS NOT NULL THEN
    INSERT INTO public.sub_regions (province_id, name, name_ar) VALUES
    (pid, 'City Center', 'وسط المدينة'), (pid, 'Nawa', 'نوى'), (pid, 'Tafas', 'طفس'),
    (pid, 'Izraa', 'إزرع'), (pid, 'Jasim', 'جاسم'), (pid, 'Sanamayn', 'الصنمين')
    ON CONFLICT DO NOTHING;
  END IF;

  -- As-Suwayda
  SELECT id INTO pid FROM public.provinces WHERE name_ar = 'السويداء' LIMIT 1;
  IF pid IS NOT NULL THEN
    INSERT INTO public.sub_regions (province_id, name, name_ar) VALUES
    (pid, 'City Center', 'وسط المدينة'), (pid, 'Shahba', 'شهبا'), (pid, 'Salkhad', 'صلخد'),
    (pid, 'Qanawat', 'قنوات')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Quneitra
  SELECT id INTO pid FROM public.provinces WHERE name_ar = 'القنيطرة' LIMIT 1;
  IF pid IS NOT NULL THEN
    INSERT INTO public.sub_regions (province_id, name, name_ar) VALUES
    (pid, 'City Center', 'وسط المدينة'), (pid, 'Khan Arnabeh', 'خان أرنبة'), (pid, 'Fiq', 'فيق')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Ar-Raqqah
  SELECT id INTO pid FROM public.provinces WHERE name_ar = 'الرقة' LIMIT 1;
  IF pid IS NOT NULL THEN
    INSERT INTO public.sub_regions (province_id, name, name_ar) VALUES
    (pid, 'City Center', 'وسط المدينة'), (pid, 'Tabqa', 'الطبقة'), (pid, 'Tell Abyad', 'تل أبيض'),
    (pid, 'Thawra', 'الثورة')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Deir ez-Zor
  SELECT id INTO pid FROM public.provinces WHERE name_ar = 'دير الزور' LIMIT 1;
  IF pid IS NOT NULL THEN
    INSERT INTO public.sub_regions (province_id, name, name_ar) VALUES
    (pid, 'City Center', 'وسط المدينة'), (pid, 'Mayadin', 'الميادين'), (pid, 'Abu Kamal', 'البوكمال'),
    (pid, 'Ashara', 'العشارة')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Al-Hasakah
  SELECT id INTO pid FROM public.provinces WHERE name_ar = 'الحسكة' LIMIT 1;
  IF pid IS NOT NULL THEN
    INSERT INTO public.sub_regions (province_id, name, name_ar) VALUES
    (pid, 'City Center', 'وسط المدينة'), (pid, 'Qamishli', 'القامشلي'), (pid, 'Ras al-Ain', 'رأس العين'),
    (pid, 'Malikiyeh', 'المالكية'), (pid, 'Amuda', 'عامودا')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 6. Add districts for new provinces with default delivery fee
INSERT INTO public.districts (province, province_ar, delivery_fee, is_active) VALUES
('Rif Dimashq', 'ريف دمشق', 15000, true),
('Idlib', 'إدلب', 20000, true),
('Daraa', 'درعا', 18000, true),
('As-Suwayda', 'السويداء', 20000, true),
('Quneitra', 'القنيطرة', 20000, true),
('Ar-Raqqah', 'الرقة', 25000, true),
('Deir ez-Zor', 'دير الزور', 25000, true),
('Al-Hasakah', 'الحسكة', 25000, true)
ON CONFLICT DO NOTHING;
