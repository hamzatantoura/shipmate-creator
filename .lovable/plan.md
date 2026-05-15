## المشكلة

طلب `courier_branches` على الواجهة الرئيسية يفشل بـ 401 ورسالة:
`permission denied for function has_role`

السبب: سياسات RLS على الجدول مقيدة بدور `authenticated` وتستدعي `has_role(...)`، والزائر (`anon`) لا يملك صلاحية تنفيذ هذه الدالة، فيُرفض الطلب كاملًا قبل تقييم `is_active = true`.

## الحل

إنشاء منظر عام (View) آمن `courier_branches_public` يكشف فقط الحقول اللازمة لرسم الخريطة (لا أرقام هاتف، لا عنوان تفصيلي)، ويفلتر تلقائيًا على الفروع النشطة. نفس النمط المستخدم حاليًا مع `couriers_public`.

بهذا أي فرع يضيفه أي شركة شحن ويكون `is_active = true` يظهر فورًا على خريطة الواجهة الرئيسية بلا أي تدخل.

### 1. ترحيل قاعدة البيانات

```sql
create or replace view public.courier_branches_public as
select id, name, lat, lng, courier_id
from public.courier_branches
where is_active = true
  and lat is not null
  and lng is not null;

grant select on public.courier_branches_public to anon, authenticated;
```

(الجدول الأصلي يبقى محميًا بسياساته الحالية — لا تغيير على RLS الجدول.)

### 2. تعديل `src/features/landing/components/CoverageMapSection.tsx`

استبدال:
```ts
supabase.from("courier_branches")
  .select("id, name, lat, lng, courier_id")
  .eq("is_active", true)
  .not("lat", "is", null)
  .not("lng", "is", null)
```
بـ:
```ts
supabase.from("courier_branches_public")
  .select("id, name, lat, lng, courier_id")
```

لا تغييرات أخرى — منطق الدبابيس الزرقاء وعدّاد فروع الشحن يعمل كما هو.

## النتيجة

- الزائر غير المسجّل يرى كل فروع الشحن النشطة على الخريطة.
- أي فرع جديد يضيفه vendor ويفعّله يظهر تلقائيًا.
- لا تسريب لبيانات حساسة (هاتف/عنوان تفصيلي مستثناة من المنظر).