# إصلاح: محافظة التاجر لا تُحفظ بشكل صحيح

## السبب الجذري للمشكلة

نظام التوجيه الذكي يبحث عن شركات الشحن بناءً على `merchants.province_id` (UUID مرجعي إلى جدول `districts`)، لكن:

1. **شاشة الإعدادات** (`MerchantShippingSettings.tsx`) تحفظ فقط الحقل النصي `merchants.city = "حلب"` ولا تحفظ `province_id` نهائياً.
2. **في قاعدة البيانات الحالية**: جميع التجار لديهم `province_id = NULL` رغم تعبئة حقل `city`.
3. **النتيجة**: في `MerchantOrdersPage.tsx` السطر 215، `merchantProvinceId` يبقى `null` → RPC `find_couriers_for_order` يُرجع قائمة فارغة → تظهر رسالة "يجب تحديد محافظتك في إعدادات الحساب أولاً" حتى بعد الحفظ.

## خطة الإصلاح

### 1. تعديل شاشة إعدادات التاجر — `MerchantShippingSettings.tsx`
- تحميل قائمة المحافظات بـ `id` (وليس فقط `province_ar`).
- استخدام `province_id` كقيمة الـ `<Select>` بدلاً من النص (مع عرض الاسم العربي).
- عند الحفظ: تخزين **كلا** الحقلين معاً:
  - `merchants.province_id` = UUID للمحافظة (المصدر الحقيقي للتوجيه)
  - `merchants.city` = اسمها العربي (للتوافق مع شاشات العرض القديمة)
- عند فتح الشاشة: تحميل `province_id` من DB، ولو كان فارغاً يُستنتج من `city` (fallback).

### 2. ترحيل بيانات (Migration SQL)
تعبئة `province_id` لكل التجار الموجودين بالاعتماد على `city` الحالي:

```sql
UPDATE merchants m
SET province_id = d.id
FROM districts d
WHERE d.parent_id IS NULL
  AND d.province_ar = m.city
  AND m.province_id IS NULL
  AND m.city IS NOT NULL;
```

### 3. التحقق من الواجهات الأخرى
مراجعة سريعة لأي مكان آخر يحدّث `merchants.city` فقط (مثل `MerchantKycCard`) للتأكد من أنه أيضاً يُحدِّث `province_id` معه — حتى لا تتكرر المشكلة من بوابة أخرى.

## النتيجة المتوقعة
بعد التطبيق:
- التجار الحاليون ستُملأ محافظتهم تلقائياً → نموذج إنشاء طلب يعرض شركات الشحن المتاحة فوراً.
- أي تاجر جديد يحفظ المحافظة من الإعدادات → `province_id` يُخزَّن مباشرةً → التوجيه الذكي يعمل من أول طلب.
