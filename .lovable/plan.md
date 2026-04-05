
## خطة التنفيذ — منصة ShipDash اللوجستية المتكاملة

### 1. تغييرات قاعدة البيانات (Migration)
- جدول `payout_requests` (merchant_id, amount, method, account_details, status, receipt_url)
- جدول `shipment_status_history` (shipment_id, old_status, new_status, changed_at, changed_by)
- تحديث enum حالات الشحنة لتشمل: `pending_pickup`, `at_warehouse`, `in_transit_intercity`, `with_distributor`, `delivered`, `returned`
- سياسات RLS مناسبة

### 2. بوابة الناقل (Carrier Portal)
- صفحة `/carrier` بقائمة الشحنات مع dropdown للحالات الجديدة
- سجل الحالات مع الطوابع الزمنية لكل شحنة
- المنطق المالي:
  - **تم التسليم**: إضافة سعر المنتج (COD) للمحفظة + خصم رسوم الشحن النهائية (base + 2,000 markup مخفي)
  - **مرتجع**: خصم 5,000 ل.س رسوم إرجاع فقط

### 3. طلبات التسوية المالية (Payout Requests)
- زر "طلب تسوية مالية" في صفحة المحفظة
- نموذج: المبلغ (مع validation)، الطريقة، تفاصيل الحساب
- لوحة إدارة `/admin/payouts` لعرض وتحديث الحالة ورفع إيصال

### 4. صفحة تتبع عامة
- صفحة `/track` تقبل رقم التتبع
- تعرض حالة الشحنة وسجل الحالات

### 5. تحديثات الواجهة
- تحديث ShipmentTable لعرض الحالات الجديدة بالعربية
- تحديث المحفظة لعرض زر التسوية
- إضافة الـ markup المخفي (2,000 SYP) في حساب رسوم الشحن

### الملفات المتأثرة:
- Migration جديد
- `src/pages/CarrierPortal.tsx` (جديد)
- `src/pages/AdminPayouts.tsx` (جديد)
- `src/pages/TrackShipment.tsx` (جديد)
- `src/pages/WalletPage.tsx` (تحديث)
- `src/components/ShipmentForm.tsx` (تحديث - markup)
- `src/components/ShipmentTable.tsx` (تحديث - حالات)
- `src/App.tsx` (routes جديدة)
