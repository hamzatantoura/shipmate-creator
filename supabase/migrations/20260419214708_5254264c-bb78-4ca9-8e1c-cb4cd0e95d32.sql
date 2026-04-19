-- 1) Add hierarchical columns
ALTER TABLE public.districts ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.districts(id) ON DELETE CASCADE;
ALTER TABLE public.districts ADD COLUMN IF NOT EXISTS name text;

-- 2) Backfill `name` from existing province_ar where empty
UPDATE public.districts SET name = COALESCE(NULLIF(area_ar,''), province_ar) WHERE name IS NULL;

-- 3) Insert sub-regions (children) under each existing province by matching province_ar
DO $$
DECLARE
  v_parent_id uuid;
  v_pairs text[][] := ARRAY[
    -- دمشق
    ARRAY['دمشق','المزة'], ARRAY['دمشق','المالكي'], ARRAY['دمشق','أبو رمانة'], ARRAY['دمشق','الميدان'],
    ARRAY['دمشق','الشعلان'], ARRAY['دمشق','باب توما'], ARRAY['دمشق','القصاع'], ARRAY['دمشق','ركن الدين'],
    ARRAY['دمشق','كفرسوسة'], ARRAY['دمشق','المهاجرين'], ARRAY['دمشق','برزة'], ARRAY['دمشق','القابون'],
    ARRAY['دمشق','جوبر'], ARRAY['دمشق','الزاهرة'], ARRAY['دمشق','الحجر الأسود'], ARRAY['دمشق','التضامن'],
    -- ريف دمشق
    ARRAY['ريف دمشق','دوما'], ARRAY['ريف دمشق','حرستا'], ARRAY['ريف دمشق','عربين'], ARRAY['ريف دمشق','زملكا'],
    ARRAY['ريف دمشق','جرمانا'], ARRAY['ريف دمشق','صحنايا'], ARRAY['ريف دمشق','جديدة عرطوز'], ARRAY['ريف دمشق','المعضمية'],
    ARRAY['ريف دمشق','داريا'], ARRAY['ريف دمشق','قطنا'], ARRAY['ريف دمشق','الزبداني'], ARRAY['ريف دمشق','مضايا'],
    ARRAY['ريف دمشق','يبرود'], ARRAY['ريف دمشق','النبك'], ARRAY['ريف دمشق','القطيفة'], ARRAY['ريف دمشق','التل'],
    ARRAY['ريف دمشق','قدسيا'], ARRAY['ريف دمشق','الكسوة'],
    -- حلب
    ARRAY['حلب','صلاح الدين'], ARRAY['حلب','السكري'], ARRAY['حلب','الشهباء'], ARRAY['حلب','الفرقان'],
    ARRAY['حلب','الموكامبو'], ARRAY['حلب','السليمانية'], ARRAY['حلب','الجميلية'], ARRAY['حلب','العزيزية'],
    ARRAY['حلب','السبيل'], ARRAY['حلب','الحمدانية'], ARRAY['حلب','حلب الجديدة'], ARRAY['حلب','الأشرفية'],
    ARRAY['حلب','الميدان'], ARRAY['حلب','بستان القصر'], ARRAY['حلب','الإعزاز'], ARRAY['حلب','الباب'],
    ARRAY['حلب','منبج'], ARRAY['حلب','عفرين'], ARRAY['حلب','جرابلس'], ARRAY['حلب','السفيرة'],
    ARRAY['حلب','عين العرب'],
    -- حمص
    ARRAY['حمص','الإنشاءات'], ARRAY['حمص','الوعر'], ARRAY['حمص','الزهراء'], ARRAY['حمص','عكرمة'],
    ARRAY['حمص','كرم الشامي'], ARRAY['حمص','الحمراء'], ARRAY['حمص','باب الدريب'], ARRAY['حمص','الحميدية'],
    ARRAY['حمص','الخالدية'], ARRAY['حمص','تلكلخ'], ARRAY['حمص','تلبيسة'], ARRAY['حمص','الرستن'],
    ARRAY['حمص','القصير'], ARRAY['حمص','تدمر'], ARRAY['حمص','المخرم'],
    -- حماة
    ARRAY['حماة','حي الحاضر'], ARRAY['حماة','الحميدية'], ARRAY['حماة','حي العصيدة'], ARRAY['حماة','حي الأربعين'],
    ARRAY['حماة','حي الفرايا'], ARRAY['حماة','حي بعث'], ARRAY['حماة','مصياف'], ARRAY['حماة','السلمية'],
    ARRAY['حماة','محردة'], ARRAY['حماة','السقيلبية'], ARRAY['حماة','سوران'], ARRAY['حماة','مورك'],
    ARRAY['حماة','كفر زيتا'],
    -- اللاذقية
    ARRAY['اللاذقية','الأشرفية'], ARRAY['اللاذقية','الصليبة'], ARRAY['اللاذقية','الرمل الجنوبي'], ARRAY['اللاذقية','الرمل الشمالي'],
    ARRAY['اللاذقية','الزراعة'], ARRAY['اللاذقية','تشرين'], ARRAY['اللاذقية','المشروع العاشر'], ARRAY['اللاذقية','الطابيات'],
    ARRAY['اللاذقية','جبلة'], ARRAY['اللاذقية','القرداحة'], ARRAY['اللاذقية','الحفة'], ARRAY['اللاذقية','كسب'],
    ARRAY['اللاذقية','صلنفة'],
    -- طرطوس
    ARRAY['طرطوس','الثكنة'], ARRAY['طرطوس','الرمل'], ARRAY['طرطوس','الكورنيش'], ARRAY['طرطوس','الشيخ سعد'],
    ARRAY['طرطوس','بانياس'], ARRAY['طرطوس','صافيتا'], ARRAY['طرطوس','الدريكيش'], ARRAY['طرطوس','الشيخ بدر'],
    ARRAY['طرطوس','القدموس'], ARRAY['طرطوس','مشتى الحلو'],
    -- درعا
    ARRAY['درعا','درعا البلد'], ARRAY['درعا','درعا المحطة'], ARRAY['درعا','طفس'], ARRAY['درعا','الصنمين'],
    ARRAY['درعا','إزرع'], ARRAY['درعا','نوى'], ARRAY['درعا','جاسم'], ARRAY['درعا','بصرى الشام'],
    ARRAY['درعا','الحراك'], ARRAY['درعا','المسيفرة'],
    -- السويداء
    ARRAY['السويداء','مدينة السويداء'], ARRAY['السويداء','صلخد'], ARRAY['السويداء','شهبا'], ARRAY['السويداء','القريا'],
    ARRAY['السويداء','عرى'], ARRAY['السويداء','المزرعة'],
    -- القنيطرة
    ARRAY['القنيطرة','مدينة القنيطرة'], ARRAY['القنيطرة','خان أرنبة'], ARRAY['القنيطرة','البعث'], ARRAY['القنيطرة','جباتا الخشب'],
    -- دير الزور
    ARRAY['دير الزور','الجورة'], ARRAY['دير الزور','القصور'], ARRAY['دير الزور','الحويقة'], ARRAY['دير الزور','الرشدية'],
    ARRAY['دير الزور','الميادين'], ARRAY['دير الزور','البوكمال'], ARRAY['دير الزور','الموحسن'], ARRAY['دير الزور','هجين'],
    -- الرقة
    ARRAY['الرقة','مدينة الرقة'], ARRAY['الرقة','الثورة'], ARRAY['الرقة','تل أبيض'], ARRAY['الرقة','معدان'],
    ARRAY['الرقة','السبخة'], ARRAY['الرقة','الكرامة'],
    -- الحسكة
    ARRAY['الحسكة','مدينة الحسكة'], ARRAY['الحسكة','القامشلي'], ARRAY['الحسكة','رأس العين'], ARRAY['الحسكة','المالكية'],
    ARRAY['الحسكة','عامودا'], ARRAY['الحسكة','الدرباسية'], ARRAY['الحسكة','تل تمر'],
    -- إدلب
    ARRAY['إدلب','مدينة إدلب'], ARRAY['إدلب','معرة النعمان'], ARRAY['إدلب','أريحا'], ARRAY['إدلب','جسر الشغور'],
    ARRAY['إدلب','سراقب'], ARRAY['إدلب','بنش'], ARRAY['إدلب','خان شيخون'], ARRAY['إدلب','حارم'],
    ARRAY['إدلب','سرمدا'], ARRAY['إدلب','الدانا']
  ];
  i int;
BEGIN
  FOR i IN 1 .. array_length(v_pairs, 1) LOOP
    SELECT id INTO v_parent_id FROM public.districts
      WHERE province_ar = v_pairs[i][1] AND parent_id IS NULL LIMIT 1;
    IF v_parent_id IS NOT NULL THEN
      INSERT INTO public.districts (province, province_ar, area, area_ar, name, parent_id, delivery_fee, is_active)
      VALUES (
        (SELECT province FROM public.districts WHERE id = v_parent_id),
        v_pairs[i][1],
        v_pairs[i][2],
        v_pairs[i][2],
        v_pairs[i][2],
        v_parent_id,
        (SELECT delivery_fee FROM public.districts WHERE id = v_parent_id),
        true
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_districts_parent_id ON public.districts(parent_id);