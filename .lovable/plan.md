## المشكلة

بطاقة "الرصيد المتوقع" في `/merchant/wallet` تستعلم عن جدول `shipments` بحالات `pending/processing/picked_up/in_transit/out_for_delivery` فقط، دون التحقق من حالة الطلب المرتبط.

نتيجة الفحص في قاعدة البيانات:
- الطلب `324a8ca1` حالته **delivered** و`shipment_id` الفعلي = `70c059a0...`
- لكن توجد 5 شحنات إضافية مرتبطة بنفس الطلب (`order_id = 324a8ca1`) لا تزال بحالات `pending` أو `picked_up` (شحنات قديمة/مكررة من محاولات إنشاء سابقة)
- نفس الحال للطلب `5ca13272` (delivered) مع شحنة `d5b0953f` ما زالت `pending`

هذه الشحنات اليتيمة/المكررة تظهر ضمن "الرصيد المتوقع" رغم أن الطلب تم تسليمه وتسوية حسابه فعلياً في الـ ledger.

## الحل

في `src/components/merchant/MerchantWallet.tsx` (داخل `fetchData`):

1. **استثناء الشحنات اليتيمة من الحساب**: عند جلب الشحنات، نضمّ بيانات الطلب المرتبط ونستبعد:
   - الشحنات التي طلبها بحالة `delivered` / `returned` / `cancelled` (حسبت بالفعل في الـ ledger)
   - الشحنات التي ليست هي الشحنة الحالية للطلب (`orders.shipment_id != shipments.id`) — أي الشحنات المكررة

2. **التعديل التقني**:
   ```ts
   .select("id, tracking_number, status, cod_amount, merchant_shipping_fee, shipping_fee, carrier_fee, collection_fee, order_id, orders!shipments_order_id_fkey(id, status, shipment_id)")
   ```
   ثم تصفية في الـ JS: استبعد إذا `s.orders?.status` ضمن `['delivered','returned','cancelled']` أو `s.orders?.shipment_id !== s.id`. وإذا لم يكن هناك `order_id` (شحنة بدون طلب) → استبعدها أيضاً.

3. **اختياري للتنظيف**: إضافة migration تحدّث حالة الشحنات اليتيمة إلى `cancelled` تلقائياً عند تسليم الطلب الحقيقي (trigger على `orders.status = 'delivered'` يجعل كل الشحنات الأخرى لنفس `order_id` بحالة `cancelled`). يمنع تكرار المشكلة.

## الملفات المتأثرة

- `src/components/merchant/MerchantWallet.tsx` — تعديل الاستعلام والتصفية
- (اختياري) migration جديدة لإلغاء الشحنات المكررة عند التسليم

## النتيجة

"الرصيد المتوقع" سيعكس فقط الشحنات النشطة فعلياً (طلبها لم يُسلَّم/يُرجع بعد) ولن يُحسب نفس الطلب مرتين.
