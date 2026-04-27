# لماذا لا ترى أي تغيير؟

التعديلات السابقة طُبّقت على `src/components/ShipmentForm.tsx`، **لكن صفحة "إضافة طلب جديد" في `/merchant/orders` لا تستخدم هذا المكوّن إطلاقاً**. هي نموذج مستقل داخل `src/pages/MerchantOrdersPage.tsx` يجلب كل الشركات النشطة مباشرة من جدول `couriers` بدون أي فلترة على الفروع (`courier_branches`) أو التسعيرة (`courier_district_rates`).

ولهذا تظهر لديك 4 شركات (`عغفغب`, `الوصول`, `masarat`, `خالد`) في القائمة مع أن `masarat` فقط لها فرع فعلي.

# الحل

تطبيق نفس قواعد التقاطع الصارمة على `MerchantOrdersPage.tsx` بدل الاعتماد على قائمة `couriers` العامة.

## التغييرات في `src/pages/MerchantOrdersPage.tsx`

1. **جلب الفروع النشطة**: إضافة استعلام جديد إلى `courier_branches` ضمن `Promise.all` الموجود (السطر 161) يجلب `id, courier_id, name, latitude, longitude` حيث `is_active = true`، ويُحفظ في state جديد `branches`.

2. **تصفية مرتبطة بالمحافظة المختارة (`form.provinceId`)**: إنشاء `useMemo` يبني قائمة `availableCouriers` تطبّق التقاطع التالي:
   - الشركة `is_active` في `couriers` ✓
   - الشركة لديها فرع `is_active` واحد على الأقل في `courier_branches` ✓
   - يوجد سجل تسعيرة في `courier_district_rates` يطابق `courier_id` و (`district_id = form.districtId` أو `district_id = form.provinceId` كـ fallback) ✓

3. **الترتيب حسب القرب الجغرافي**: إذا كان للمحافظة/المنطقة المختارة إحداثيات (`latitude/longitude` في جدول `districts`)، حساب مسافة Haversine بين كل فرع وإحداثيات المنطقة، وترتيب `availableCouriers` تصاعدياً حسب أقرب فرع لكل شركة. عند غياب الإحداثيات، يُستخدم الترتيب الأبجدي كاحتياط.

4. **استبدال قائمة العرض**: في الجزء الذي يعرض بطاقات الشركات (حوالي السطر 477 `{couriers.map((c) => ...)}` ) → استخدام `availableCouriers` بدل `couriers`.

5. **رسائل حالة دقيقة بالعربية** بدل "لا توجد شركات شحن مفعلة لهذه الوجهة" العامة:
   - عند عدم اختيار محافظة: "اختر المحافظة أولاً لعرض شركات الشحن وأسعارها" (موجودة).
   - عند اختيار محافظة وعدم وجود فروع نشطة في المنطقة: **"لا يوجد فرع شحن متاح لهذه المنطقة"**.
   - عند وجود فروع لكن بدون تسعيرة مطابقة: **"لا توجد تسعيرة لهذه الوجهة"**.

6. **تنظيف رسوم التوصيل**: إبقاء `resolveDeliveryFee` كما هو لكن لن يتم احتساب fallback إلى `district.delivery_fee` العام إلا إذا وُجدت تسعيرة شركة (لأن الشركات بدون تسعيرة لن تظهر أصلاً).

## ملاحظة حول تحذير console

تحذير `Function components cannot be given refs ... DialogFooter` يأتي من تمرير ref إلى `DialogFooter` داخل `MerchantOrdersPage`. ليس له علاقة بمشكلة الفلترة لكنه ملاحظ في السجلات. سأصلحه ضمن نفس التعديل بإزالة الـ ref الزائد إن وُجد.

## الملفات المعدّلة
- `src/pages/MerchantOrdersPage.tsx` (التغيير الرئيسي)

بعد موافقتك سأنفّذ التعديلات مباشرة.
