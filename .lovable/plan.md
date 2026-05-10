# خطة: إضافة 4 خرائط للنظام

البنية التحتية موجودة (Leaflet + react-leaflet مثبتان فعلاً في `LocationPicker`). كل الإضافات **جديدة** ولن تعدّل سلوك الصفحات الحالية — فقط نضيف مكونات/صفحات جديدة وأزرار للوصول إليها.

---

## ١. مكوّن مشترك: `SilaMap`
ملف جديد: `src/shared/components/maps/SilaMap.tsx`

غلاف موحّد فوق Leaflet — يضمن نفس الستايل (dark navy + orange tokens)، تحميل CSS مرة واحدة، إصلاح أيقونة Marker.
يدعم: مركز/زوم، markers متعددة بأيقونات ملوّنة، نقر على marker، حدود تلقائية (`fitBounds`).

لن يلمس `LocationPicker` الموجود.

---

## ٢. خريطة فروع شركات الشحن (Admin)
صفحة جديدة: `src/features/admin/pages/AdminCoverageMap.tsx`
- تجلب `courier_branches` (lat/lng + courier name + province) و `couriers` للفلترة.
- markers برتقالية لكل فرع، popup فيه اسم الشركة + الفرع + الهاتف.
- فلتر علوي: شركة الشحن / المحافظة / النشط فقط.
- إحصائية: عدد الفروع، عدد المحافظات المغطاة.

إضافة route جديد `/admin/coverage-map` + بند في `MerchantSidebar` (قسم admin) — **لا حذف لأي بند موجود**.

---

## ٣. خريطة اختيار عنوان العميل عند إنشاء الطلب (Merchant)
- نضيف زر "📍 تحديد على الخريطة" داخل `ShipmentForm`/`EditOrderDialog` يفتح Dialog فيه `LocationPicker` (موجود).
- عند الحفظ: نخزّن `customer_lat` / `customer_lng` في `orders` (الأعمدة موجودة فعلاً).
- اختياري بالكامل — لو ما ضغط الزر ينحفظ الطلب بدون إحداثيات تماماً مثل الآن.

---

## ٤. خريطة تتبع الطلب (Public Tracking)
- تعديل غير مكسور في `TrackOrderPage`: أسفل التايملاين الحالي نضيف بطاقة "موقع التسليم".
- يعرض: `customer_lat/lng` للعميل + إحداثيات `courier_branches` للفرع المعيّن (`assigned_branch_id`).
- لو الإحداثيات مفقودة → البطاقة لا تظهر (graceful fallback).

---

## ٥. خريطة "تغطية الأحياء" (Admin) — إثراء بيانات
صفحة جديدة: `src/features/admin/pages/AdminDistrictsMap.tsx`
- خريطة لسوريا + markers لكل حي عنده lat/lng.
- الأحياء بدون إحداثيات تظهر في قائمة جانبية: ضغطة على الحي → ضغطة على الخريطة → استدعاء RPC `set_district_coords` → تحديث لحظي.
- يحل مشكلة "حلب فقط فيها إحداثيات".

route جديد `/admin/districts-map` + بند في sidebar admin.

---

## ٦. خريطة Demo في Landing (تسويق)
مكوّن جديد: `src/features/landing/components/CoverageMapSection.tsx`
- يُضاف **بعد** `Workflow` في `Landing.tsx` (إضافة سطر واحد، لا تعديل لأي قسم).
- يعرض: `ALEPPO_MERCHANTS` (تجار) + فروع شركات الشحن في حلب من DB.
- بدون تفاعل مع DB للزوار — read-only public select على `courier_branches` (السياسة موجودة لـ active=true).

---

## ضمانات عدم كسر الصفحات الحالية
- لا تعديل على: `client.ts`, `types.ts`, schema قاعدة البيانات (الأعمدة المطلوبة موجودة كلها: `orders.customer_lat/lng`, `districts.lat/lng`, `courier_branches.lat/lng`, `orders.assigned_branch_id`).
- لا تعديل على RLS — كل البيانات تُقرأ ضمن السياسات الحالية.
- `LocationPicker` يُستخدم كما هو دون تعديل.
- كل مكوّن جديد lazy-loaded عبر `React.lazy` في الراوتر للحفاظ على bundle size.

---

## التفاصيل التقنية (للمراجعة)
- لا حاجة لـ migration — كل الأعمدة الجغرافية موجودة.
- لا حاجة لمكتبات جديدة (`leaflet` و `react-leaflet` مثبتة).
- مركز سوريا الافتراضي: `[34.8, 38.9]` zoom 7.
- ستايل tile: OpenStreetMap (مجاني، بدون API key).
- أيقونات Marker مخصصة بـ DivIcon لاستخدام لون `--primary` (orange #FF8C00).

---

## ترتيب التنفيذ
1. `SilaMap` المشترك
2. خريطة Landing (سهلة، بدون auth)
3. خريطة Admin Coverage (فروع)
4. خريطة Admin Districts (إثراء lat/lng)
5. تكامل LocationPicker في ShipmentForm
6. خريطة Tracking

تقريباً 6 ملفات جديدة + تعديلات صغيرة في `router.tsx`, `MerchantSidebar`, `Landing.tsx`, `ShipmentForm`, `TrackOrderPage`.
