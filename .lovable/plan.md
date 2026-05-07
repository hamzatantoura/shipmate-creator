## السياق

سؤالك يتضمن 3 نقاط مرتبطة. سأشرحها ثم أقدّم الخطة.

### 1) ما الفرق بين "الرصيد المتاح" و "بانتظار التحاسب"؟

- **الرصيد المتاح** = مجموع حركات دفتر المحفظة (`wallet_transactions`) — الفلوس التي تستطيع طلب تسويتها الآن.
- **بانتظار التحاسب** (الحالي) = حساب تقريبي على الواجهة فقط للطلبات التي حالتها `delivered` ولم تُسجَّل بعد كحركة `cod_settlement` في الدفتر. الفائدة الوحيدة: إخبارك "كم مبلغاً وصل العميل لكنه لم يدخل محفظتك بعد".

في النظام الحالي trigger قاعدة البيانات يُسجّل `cod_settlement` فوراً عند تغيير الحالة إلى `delivered`. لذلك هذه البطاقة دائماً ≈ صفر، ولا قيمة تشغيلية واضحة لها → موافق أن نزيلها.

### 2) المرتجعات (الأرضية موجودة فعلاً جزئياً)

- جدول `couriers` يحوي `return_fee_percentage` (نسبة رسوم الإرجاع لكل شركة شحن)، ويُدار من واجهة الإدارة (`AdminCouriersManagement`).
- جدول `platform_settings` يحوي `return_cost_responsibility` (`merchant` / `platform`) و `default_return_fee`.
- trigger التسوية يخصم تلقائياً `return_fee` من محفظة التاجر عند تغيير حالة الطلب إلى `returned` (إذا كانت المسؤولية على التاجر) ويستخدم `carrier_fee + platform_margin`.

النقص: لا توجد ربط مباشر بـ `return_fee_percentage` للناقل في الـ trigger الحالي (يستخدم `carrier_fee` بدل النسبة)، ولا واجهة للتاجر تُظهر تفاصيل خصومات المرتجع.

---

## الخطة

### الخطوة A — استبدال البطاقة الصفراء "بانتظار التحاسب"

في `src/pages/MerchantDashboard.tsx`:
- إزالة بطاقة "بانتظار التحاسب" والحقل `onHoldBalance`.
- تحويل الشبكة إلى `md:grid-cols-2`: الرصيد المتاح + الرصيد المتوقع.
- جعل بطاقة "الرصيد المتاح" قابلة للنقر → تنقل إلى `/merchant/wallet` (حيث يوجد سجل الحركات الكامل).

### الخطوة B — تحسين عرض حركات المحفظة (سجل أنيق)

في `src/components/shared/WalletTransactionsLog.tsx` (المستخدم في `MerchantWallet`):
- إضافة فلاتر سريعة (الكل / دائن / مدين / المرتجعات / التسويات).
- إضافة ملخص علوي: إجمالي الدائن، إجمالي المدين، الصافي.
- عند نقر أي حركة مرتبطة بطلب → فتح Dialog يعرض: رمز الطلب، التاريخ، نوع الحركة، الوصف، المبلغ، رابط للطلب الأصلي.
- إبراز حركات `return_fee` بلون مميز ورسالة واضحة "خصم رسوم إرجاع — طلب SL-XXXXXX".

### الخطوة C — أرضية المرتجع المرتبطة بإعدادات الإدارة

تعديل دالة `fn_settle_order_on_status_change` (trigger) لتستخدم النسبة المعرّفة في `couriers.return_fee_percentage` بدل احتساب `carrier_fee + platform_margin`:

```text
عند status = 'returned' و return_responsibility = 'merchant':
  return_fee = (final_sale_price * couriers.return_fee_percentage / 100)
  أو fallback: platform_settings.default_return_fee
  insert wallet_transactions (type='return_fee', amount=-return_fee, reference_id=order.id)
```

هذا يضمن أن أي تعديل تجريه الإدارة على نسبة الإرجاع لشركة شحن ينعكس فوراً على الخصومات المستقبلية، بدون لمس أي طلبات قديمة.

### الخطوة D — عرض المرتجعات في لوحة التاجر

- في الداشبورد، بطاقة "مرتجعات" الموجودة تبقى كما هي.
- في صفحة المحفظة، إضافة قسم "المرتجعات الأخيرة" يعرض آخر 5 حركات `return_fee` مع رمز الطلب وسبب الإرجاع (`orders.return_reason`).

---

## الملفات المتأثرة

- `src/pages/MerchantDashboard.tsx` — حذف بطاقة + جعل الرصيد المتاح قابل للنقر
- `src/components/shared/WalletTransactionsLog.tsx` — فلاتر + ملخص + dialog تفاصيل
- `src/components/merchant/MerchantWallet.tsx` — قسم مرتجعات أخيرة
- migration جديد — تحديث `fn_settle_order_on_status_change` لاستخدام `return_fee_percentage`

## ما لن يتغيّر

- لا حذف ولا تعديل لأي بيانات موجودة في `wallet_transactions` أو `orders`.
- لا تغيير على واجهة الإدارة (موجودة فعلاً).
- لا تغيير على flow الطلبات/الشحنات.

---

## أسئلة قبل التنفيذ

1. **حساب رسوم الإرجاع**: تريدها نسبة من `final_sale_price` (سعر البيع)، أم من `delivery_fee` (أجرة الشحن فقط)، أم مبلغ ثابت من إعدادات الناقل؟
2. **هل أنفّذ الخطوات الأربع معاً**، أم نبدأ بـ A+B فقط (الواجهة) ونؤجّل C+D للمرحلة التالية؟
