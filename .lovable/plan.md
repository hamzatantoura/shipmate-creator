
## تقرير الفحص الشامل للروابط والصفحات

قمت بفحص ملفات `App.tsx` وكل الصفحات والمكونات. النتائج مصنّفة حسب الخطورة.

---

### 🔴 مشاكل حرجة (روابط معطلة / صفحات وهمية)

| # | المشكلة | الموقع | السلوك الحالي |
|---|---------|--------|----------------|
| 1 | صفحات Legacy وهمية تستخدم `MERCHANT_ID = "00000000-..."` ثابت | `src/pages/Orders.tsx`, `src/pages/Products.tsx`, `src/pages/WalletPage.tsx`, `src/pages/Index.tsx` | تعرض بيانات لتاجر غير موجود — مرتبطة بـ routes `/orders`, `/products`, `/wallet` |
| 2 | المسار `/dashboard` يفتح صفحة **Login** | `App.tsx:129` | يربك المستخدم بعد تسجيل الدخول |
| 3 | زر "إنشاء شحنة" في `Orders.tsx` يوجّه إلى `/dashboard?...` (= Login) | `Orders.tsx:61` | زر مكسور تماماً |
| 4 | المسار `/pricing` غير موجود لكنه مذكور 3 مرات في الصفحة الرئيسية | `Landing.tsx:45,95,279` | يفتح **NotFound** |
| 5 | `TopUp.tsx` زر "العودة" يذهب إلى `/wallet` (الصفحة الوهمية القديمة) | `TopUp.tsx:61` | المفترض `/merchant/wallet` |
| 6 | شعار "Sila" في `MerchantLayout` يذهب إلى `/` (Landing) | `MerchantLayout.tsx:25` | يخرج التاجر من لوحته بدل الذهاب إلى `/merchant/dashboard` |
| 7 | في `AdminLogistics.tsx:141` استخدام UUID وهمي `...000001` لمحفظة المنصة | الكود | يجب الاعتماد على ledger الفعلي |

---

### 🟠 مشاكل متوسطة (UX / تنظيم)

- `App.tsx` يحتفظ بـ routes قديمة `/orders`, `/products`, `/wallet` بجانب الحديثة `/merchant/*` → ازدواجية مربكة.
- `Landing.tsx` يحتوي قسم "الأسعار" في الـ Footer لكن لا توجد صفحة `/pricing`.
- `Index.tsx` صفحة قديمة ما زالت موجودة في الكود لكن غير مرتبطة بأي route (كود ميت).
- `AdminDistricts.tsx` صفحة موجودة لكن يتم redirect منها إلى `?tab=districts` — يمكن حذف الملف.
- صفحة TopUp تعرض رسالة "سيتم مراجعته قريباً" بدون رابط لتتبّع الطلب.

---

### 🟢 اقتراحات تحسين UX

1. **breadcrumbs موحدة** في كل صفحات `/merchant/*` و `/admin/*` لتسهيل التنقل.
2. **زر "العودة للوحة"** في صفحات فرعية (TopUp مثلاً) بدل العودة العمياء.
3. **شارة Notifications** في الهيدر للتاجر (طلبات جديدة، تسوية مكتملة).
4. **Empty State احترافي**: حالياً صفحة المنتجات/الطلبات الفارغة بسيطة — أضف CTA واضح ("أضف منتجك الأول").
5. **دعم Keyboard shortcuts** للإدمن (تبديل سريع بين tabs).
6. **حفظ آخر فلتر** في صفحة الطلبات (status, date range) في `sessionStorage`.

---

## خطة التنفيذ (Step 19: Navigation & Cleanup)

### A. إصلاح الروابط المكسورة
1. **حذف Routes والصفحات القديمة الميتة**:
   - حذف الملفات: `src/pages/Orders.tsx`, `src/pages/Products.tsx`, `src/pages/WalletPage.tsx`, `src/pages/Index.tsx`, `src/pages/AdminDistricts.tsx`.
   - تحويل `/orders`, `/products`, `/wallet` في `App.tsx` إلى `<Navigate>` نحو `/merchant/orders`, `/merchant/products`, `/merchant/wallet`.
   - تحويل `/dashboard` من `<Login />` إلى `<Navigate to="/login" replace />` (أو إلى `/merchant` إذا مسجّل دخول).

2. **إصلاح `TopUp.tsx`**: تغيير زر العودة من `/wallet` إلى `/merchant/wallet`.

3. **إصلاح شعار `MerchantLayout`**: تغيير `Link to="/"` إلى `Link to="/merchant"` (نفس الشيء لـ `CourierOrders` header إن لزم).

4. **إصلاح روابط `/pricing` في Landing**:
   - الخيار الأبسط: إزالة الروابط الثلاثة واستبدالها بسحب نحو قسم الأسعار داخل نفس الصفحة (anchor `#pricing`) أو تحويلها إلى `/signup`.
   - (نتجنّب إنشاء صفحة pricing فارغة لأن السياسة تمنع المحتوى الوهمي).

5. **تنظيف `AdminLogistics.tsx`**: استبدال `eq("merchant_id", "00000000-...001")` باستعلام صريح من جدول المحفظة الخاص بالمنصة (إن وُجد) أو إزالته إذا أصبحت أرباح المنصة محسوبة من triggers الـ ledger في Step 18.

### B. تحسينات UX سريعة
6. إضافة **زر "العودة إلى المحفظة"** في `TopUp.tsx` بشكل واضح في الأعلى.
7. تحسين **Empty States** في `MerchantOrdersPage` و `MerchantProductsPage` بـ illustration + CTA رئيسي.
8. إضافة **breadcrumbs** في صفحات `/merchant/orders`, `/merchant/products`, `/merchant/wallet`, `/topup`.

### C. ضمانات (Strict Logic Guard)
- لن يتم تعديل أي منطق مالي أو تسعير.
- لن تُضاف صفحات فارغة أو "Coming Soon".
- كل route محذوف يُستبدل بـ `<Navigate>` لمنع كسر الإشارات الخارجية المحفوظة.

---

## الملفات التي ستُعدّل/تُحذف

**حذف:**
- `src/pages/Orders.tsx`
- `src/pages/Products.tsx`
- `src/pages/WalletPage.tsx`
- `src/pages/Index.tsx`
- `src/pages/AdminDistricts.tsx`

**تعديل:**
- `src/App.tsx` (إعادة توجيه legacy routes)
- `src/pages/TopUp.tsx` (إصلاح زر العودة + breadcrumb)
- `src/components/merchant/MerchantLayout.tsx` (إصلاح رابط الشعار)
- `src/pages/Landing.tsx` (إصلاح روابط /pricing)
- `src/pages/AdminLogistics.tsx` (إزالة UUID الوهمي للمحفظة)
- `src/pages/MerchantOrdersPage.tsx` + `MerchantProductsPage.tsx` (تحسين Empty States)

---

هل توافق على تنفيذ Step 19 كاملاً، أم تفضّل أن نبدأ بالقسم A (الإصلاحات الحرجة) فقط ونؤجّل تحسينات UX (القسم B) لخطوة لاحقة؟
