# إصلاح فشل تحديث حالة "مرتجع" (Foreign Key Violation)

## السبب الجذري المؤكد
عند تحديث الشحنة إلى `returned`، ينطلق تريغر `handle_shipment_wallet_settlement` الذي يحاول تسجيل قيود محاسبية على **محفظة المنصة** بالمُعرّف الثابت `00000000-0000-0000-0000-000000000001`.

تحقّقت من قاعدة البيانات: **هذه المحفظة غير موجودة أصلاً في جدول `wallets`**، لذا أي INSERT في `wallet_transactions` يستهدفها يفشل بـ FK violation، ويُلغى التحديث بأكمله (rollback)، فلا تُحفظ حالة الإرجاع.

نفس المشكلة ستحدث عند **التسليم الناجح** أيضاً (نفس الكود يحاول تسجيل عمولة المنصة) — أي أن النظام المالي معطّل بالكامل لكل الشحنات.

## خطة الإصلاح (Migration واحد)

### 1. إنشاء محفظة المنصة (Platform Wallet) بشكل دائم
- إضافة `is_platform boolean DEFAULT false` إلى جدول `wallets` (لتمييزها).
- جعل عمود `merchant_id` يقبل NULL **فقط** للمحفظة الرئيسية للمنصة.
- إدراج (idempotent) سجل المحفظة بالمُعرّف الثابت `00000000-0000-0000-0000-000000000001` و `is_platform=true`.

```sql
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS is_platform boolean NOT NULL DEFAULT false;
ALTER TABLE wallets ALTER COLUMN merchant_id DROP NOT NULL;
ALTER TABLE wallets ADD CONSTRAINT wallets_merchant_or_platform 
  CHECK (is_platform = true OR merchant_id IS NOT NULL);

INSERT INTO wallets (id, merchant_id, balance, is_platform)
VALUES ('00000000-0000-0000-0000-000000000001', NULL, 0, true)
ON CONFLICT (id) DO NOTHING;
```

### 2. تحصين تريغرات التسوية (Defense-in-Depth)
تعديل `handle_shipment_wallet_settlement` و `handle_order_delivered_settlement` بحيث:
- يتأكدان من وجود محفظة المنصة قبل أي قيد، وإن لم تكن موجودة يُنشئانها فوراً (`INSERT … ON CONFLICT DO NOTHING`).
- يتأكدان من وجود محفظة التاجر بنفس الأسلوب.
- بهذا لن يحدث FK violation حتى لو تأخرت الـ migrations لأي سبب.

### 3. مواءمة `handle_courier_wallet_credit` مع بروتوكول Ledger
حالياً يكتب على عمود `couriers.wallet_balance` مباشرة (مخالف لبروتوكول Sila #3 الذي يفرض الـ Ledger).
- التأكد من وجود الأعمدة (`wallet_balance`, `return_fee_percentage`) — إن لم توجد سيتم تجاوز الكتابة بأمان عبر `BEGIN...EXCEPTION WHEN undefined_column`.
- (مرحلة لاحقة منفصلة): نقل المنطق بالكامل إلى جدول `wallet_transactions` خاص بالمحاسب (out of scope الآن لتجنّب تغييرات كبيرة).

### 4. ترحيل المعاملات المعلّقة (Backfill)
- لا حاجة لـ backfill مالي، فقط إنشاء محفظة المنصة يكفي لفك القفل.
- التأكد من أن كل تاجر له محفظة عبر `auto_create_merchant_wallet` (مفعّل أصلاً على trigger).

## ما لن يتغيّر
- لا تعديلات على الواجهة الأمامية — المشكلة 100% في قاعدة البيانات.
- لا تعديلات على منطق القفل (`enforce_order_lock`) — يعمل بشكل صحيح حسب التحقق.
- منطق المسؤولية عن الإرجاع (`return_cost_responsibility`) يبقى كما هو.

## النتيجة المتوقعة
- زر **"تأكيد الإرجاع"** سيعمل فوراً بعد تطبيق الـ migration.
- التسليم الناجح أيضاً سيُسجّل عمولة المنصة بدون فشل.
- لن تظهر رسالة `wallet_transactions_wallet_id_fkey` مرة أخرى.
