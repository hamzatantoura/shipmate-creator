## المشكلة

في صفحة المنتج (`ProductPage.tsx`)، قائمة "المحافظة" تعرض الصفوف المدمجة من جدول `districts` بصيغة:

```
إدلب — حارم
إدلب
إدلب — أريحا
إدلب — مدينة إدلب
...
```

السبب: نمرّ على كل سجلات `districts` ونعرض `province_ar — area_ar` في قائمة واحدة، فتبدو المحافظات مكررة والمناطق مختلطة معها.

## الحل المقترح (UI فقط، بدون تغيير قاعدة البيانات)

تحويل القائمة الواحدة إلى **قائمتين متتاليتين**:

1. **المحافظة** → قيم فريدة فقط (مثلاً: إدلب، حلب، دمشق...) مستخرجة من `districts.province_ar`.
2. **المنطقة / المركز** → السجلات المنتمية للمحافظة المختارة فقط، وتعرض `area_ar` (أو "مركز المحافظة" عندما يكون `area_ar` فارغاً).

تبقى قائمة "الحي / المنطقة" الحالية (من `sub_regions`) كما هي، وتُملأ بعد اختيار المنطقة بنفس المنطق الحالي.

## التغييرات في الكود

ملف وحيد: `src/features/storefront/pages/ProductPage.tsx`

1. إضافة `state` جديد:
   - `selectedProvinceAr: string` (اسم المحافظة المختارة).
2. اشتقاق قائمة المحافظات الفريدة:
   ```ts
   const uniqueProvinces = Array.from(
     new Map(districts.map(d => [d.province_ar, d])).values()
   );
   ```
3. اشتقاق المناطق ضمن المحافظة المختارة:
   ```ts
   const provinceDistricts = districts.filter(d => d.province_ar === selectedProvinceAr);
   ```
4. استبدال `Select` الحالي بقائمتين:
   - الأولى: تعرض `uniqueProvinces` بالاسم العربي فقط، وتعيد ضبط `selectedDistrict` و`selectedSubRegion` عند التغيير.
   - الثانية: تعرض `provinceDistricts` بـ `area_ar || "مركز المحافظة"`، وتُحدّث `selectedDistrict` (نفس الـ id الحالي المستخدم في الـ RPC).
5. تعطيل القائمة الثانية حتى يتم اختيار محافظة، وإظهار placeholder مناسب.
6. لا تغيير على `handleOrder` ولا على `create_storefront_order` لأن `selectedDistrict` يبقى يحمل `districts.id` كما كان.

## ملاحظات

- لا حاجة لأي migration أو تعديل في الـ backend.
- المنطق الخاص بسعر الشحن (`rawDeliveryFee`)، الشحن المجاني (`isShippingFreeForCustomer`)، وفلترة `sub_regions` يبقى كما هو لأنه يعتمد على `selectedDistrictObj`.
- التحقق في `handleOrder` (`!selectedDistrict`) يكفي؛ نضيف فقط رسالة "اختر المحافظة أولاً" داخل القائمة الثانية.
