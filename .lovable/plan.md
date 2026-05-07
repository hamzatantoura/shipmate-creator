## السبب الجذري

عند طباعة بوليصة الشحن، يتم إنشاء الشحنة عبر دالة `createShipmentForOrder` في `src/pages/MerchantOrdersPage.tsx` (السطور 199-227). هذه الدالة تحفظ:

```ts
collection_fee: fee,   // ← خطأ! fee = أجور التوصيل وليس بدل التحصيل
shipping_fee: fee,
```

أي أنها تضع **قيمة أجور التوصيل** في حقل `collection_fee` بدل أن تحسب بدل التحصيل من إعدادات الشركة (`cod_fee_type` / `cod_fee_value`) في جدول `couriers`.

النتيجة:
- بدل التحصيل المخزّن على الشحنة = أجور التوصيل (مثلاً 15000 ل.س)
- لا علاقة له بقيمة `cod_fee_value` التي ضبطها الأدمن (مثلاً 1% أو 150 ل.س ثابت)
- محرك الـ pricing engine الصحيح موجود في `src/lib/pricing-engine.ts` لكنه غير مُستخدَم في هذا المسار

ملاحظة: المسار الآخر `MerchantOrders.tsx` (تأكيد الطلب) يحسب القيمة بشكل صحيح عبر `calculatePricing`. فقط مسار طباعة البوليصة معطوب.

## الإصلاح

في `src/pages/MerchantOrdersPage.tsx`:

1. تعديل `createShipmentForOrder` لتقبل بيانات الـ COD config للشركة، أو تجلبها داخلياً من `couriers` بناءً على `order.courier_id`.
2. استخدام `calculatePricing` من `pricing-engine.ts` لحساب:
   - `collection_fee` (من `cod_fee_type` + `cod_fee_value`)
   - `merchant_shipping_fee`، `carrier_fee`، `platform_margin`
3. حفظ القيم الناتجة في حقول الشحنة الصحيحة بدل تكرار `fee` في كلا الحقلين.
4. قراءة `platform_settings` (موجودة عبر `use-platform-settings`) لتمريرها كـ fallback.

## الملفات المتأثرة

- `src/pages/MerchantOrdersPage.tsx` — تعديل `createShipmentForOrder` واستدعاءاتها (السطور 199-227، 490، 838).

## النتيجة

بدل التحصيل المخزّن على كل شحنة جديدة سيعكس فعلياً ما يضبطه الأدمن في إعدادات شركة الشحن (نسبة % أو قيمة ثابتة)، وسيظهر بشكل صحيح في المحفظة وفي صفحة المندوب.
