
## التشخيص النهائي

طلب الشبكة من جلستك الحالية (أدمن `hamza.tantoura@gmail.com`) يُظهر:

```
GET /rest/v1/couriers?select=*  →  403  "permission denied for table couriers"
```

السبب ليس في:
- ❌ الكود (سليم: `supabase.from("couriers").select("*")`)
- ❌ سياسات RLS (سليمة: `Admins can view all couriers` تعمل عبر `has_role`)
- ❌ دور المستخدم (مؤكد: أنت أدمن في `profiles` و `user_roles`)
- ❌ جلسة الدخول (JWT صحيح، sub يطابق حساب الأدمن)

السبب هو في طبقة **أعمق** من RLS:

> **جميع جداول قاعدة البيانات (29 جدول) لا تملك أي `GRANT` لدور `authenticated` على مستوى Postgres.**

في Postgres، `GRANT` يأتي **قبل** RLS. إذا لم يُمنح الدور حق `SELECT` على الجدول أصلاً، فلا أهمية لسياسات RLS مهما كانت متساهلة — النتيجة دائماً `42501 permission denied`.

تم التحقق عبر `information_schema.role_table_grants`: كل الجداول تُرجع `__NONE__` لدور `authenticated`.

السبب التاريخي المحتمل: migration سابق نفّذ `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated` (غالباً أثناء إعادة هيكلة الأدوار) ولم تتم إعادة الـ GRANTS.

هذا يفسّر **كل** الأعراض التي عانيت منها:
- اختفاء شركات الشحن من واجهة الأدمن.
- "اختفاء" ميزات بعد كل تعديل (لم تختفِ — لم تكن تعمل أصلاً).
- كثرة أخطاء 403 / Permission denied في واجهات التاجر والشركة.
- سلوك متذبذب: استعلامات بأعمدة محددة قد تنجح عبر مسار `anon` بينما `select=*` يفشل.

## خطة الإصلاح (Migration واحد، بدون تعديل أي كود)

### Stage 1 — إعادة منح صلاحيات Postgres الأساسية

Migration جديد يُنفّذ:

```sql
-- منح authenticated الحقوق الأساسية على كل جداول schema public
GRANT USAGE ON SCHEMA public TO authenticated, anon;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public
  TO authenticated;

-- anon يحصل على SELECT فقط (للجداول العامة كـ provinces/products النشطة)
GRANT SELECT
  ON ALL TABLES IN SCHEMA public
  TO anon;

-- صلاحيات على الـ sequences (مطلوبة للـ INSERT)
GRANT USAGE, SELECT
  ON ALL SEQUENCES IN SCHEMA public
  TO authenticated;

-- ضمان أن أي جدول جديد مستقبلاً يحصل على نفس الصلاحيات تلقائياً
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
```

**ملاحظة أمان مهمة:** هذا لا يكسر الأمان. **سياسات RLS ستظل تعمل** وتُحدّد بالضبط أي صف يستطيع كل دور رؤيته/تعديله. الـ GRANT يفتح فقط "الباب الخارجي"، أما RLS فهي "الحارس" الذي يقرر من يمر فعلياً. كل سياسات `has_role(...)` و `auth.uid() = ...` ستظل تعمل كما هي.

### Stage 2 — التحقق

بعد تنفيذ الـ migration:
1. أعد تحميل صفحة `/admin?tab=couriers` (Ctrl+F5).
2. يجب أن ترى الشركات الأربع: `masarat`, `كرم لشحن`, `الوصول`, `عغفغب`.
3. اختبر تبويبات الأدمن الأخرى (تجار، تسويات، إعدادات).
4. سجّل خروجاً ودخل بحساب التاجر — يجب أن تختفي الأخطاء 403 من واجهة التاجر أيضاً.

### Stage 3 — لا تغييرات على الكود

لن أعدّل أي ملف TypeScript/React. المشكلة كلها في طبقة قاعدة البيانات. هذا أنظف وأأمن إصلاح ممكن.

## ما لن أفعله في هذه الجولة

- لن أحذف الملفات اليتيمة (`MerchantOrders.tsx` إلخ) — مرحلة منفصلة بعد التأكد أن كل شيء يعمل.
- لن أربط `BarcodeScanner` — مرحلة منفصلة.
- لن أُصلح بيانات الشركات بدون `vendor_id` — مرحلة منفصلة.
- لن ألمس أي تصميم أو سلوك UI.

نُركّز على **الإصلاح الجذري الواحد** الذي يُعيد كل الواجهات للعمل، ثم نقرر معاً ما التالي بناءً على ما يظهر فعلاً.

## القسم التقني (للمراجعة)

- الـ migration يستهدف فقط `schema public`. لا يلمس `auth/storage/realtime/supabase_functions/vault`.
- يستخدم `ALTER DEFAULT PRIVILEGES` لمنع تكرار المشكلة عند إنشاء جداول مستقبلية.
- لا تغيير على RLS، لا حذف/تعديل سياسات.
- لا تغيير على دوال أو triggers.
- متوافق مع نموذج Supabase القياسي (الإعداد الافتراضي يمنح authenticated/anon هذه الصلاحيات).
