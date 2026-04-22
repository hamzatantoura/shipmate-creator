

## المشكلة الحقيقية في إنشاء حساب شركة الشحن

### تشخيص دقيق (من سجلات Auth وقاعدة البيانات)

1. **السبب الجذري للظاهرة "تظهر ثم تنحذف"**: عند الضغط على "إنشاء وربط الحساب"، تستدعي الواجهة `supabase.auth.signUp()` — وهذا يقوم تلقائياً **بتسجيل دخول الأدمن الحالي بحساب الـ courier الجديد**! ثم تتغير صلاحيات الجلسة فوراً من `admin` إلى `vendor`، وسياسات RLS على جدول `couriers` تمنع الـ vendor من تعديل سجل courier ليس مرتبطاً به → فيفشل تحديث `vendor_id`، ويعود `AuthGuard` ليعيد توجيه الأدمن، فتختفي الواجهة.

2. **لماذا تسجيل الدخول لا يعمل بعد الإنشاء (`Invalid login credentials`)**:
   - في إعدادات Cloud، تأكيد البريد الإلكتروني **مفعّل**. 
   - السجل يُظهر أن المستخدم `msarat1@courier.sila.local` تم إنشاؤه لكن `email_confirmed_at = null` (غير مؤكد).
   - بما أن البريد وهمي (`@courier.sila.local`)، لا يوجد صندوق بريد لتأكيده → الحساب يبقى مغلقاً للأبد.
   - لذلك المعلومات التي تدخلها **غير صالحة للدخول** بوضعها الحالي.

3. **مشكلة ثانوية**: الـ couriers الموجودون لديك (`masarat`, `كرم للشحن`, `خالد`) كل `vendor_id` فيهم يشير لنفس مستخدم قديم (`d47666f3...`)، وليس مستخدماً مخصصاً لكل شركة.

---

### الحل الذي سأنفذه

**1. إنشاء Edge Function آمنة `create-courier-account`** (تستخدم `SUPABASE_SERVICE_ROLE_KEY`)
- تتحقق أن المستدعي أدمن.
- تستخدم `supabase.auth.admin.createUser({ email, password, email_confirm: true })` → ينشئ المستخدم **ومُؤكَّد فوراً** بدون الحاجة لبريد حقيقي.
- تحدّث `user_roles` و`profiles` بدور `vendor`.
- تحدّث `couriers.vendor_id` و`couriers.contact_email` للسجل المحدد.
- تُعيد `{ user_id, login_email }`.
- **لا تغيّر جلسة الأدمن أبداً** (لأن العملية تتم على السيرفر).

**2. تعديل `AdminCouriersManagement.tsx`**
- استبدال `supabase.auth.signUp` بـ `supabase.functions.invoke('create-courier-account', {...})`.
- بعد النجاح: تحديث الـ state محلياً وإظهار بانر "حساب مُفعّل ومرتبط" + بيانات الدخول مع زر النسخ، **بدون أي تغيير على جلسة الأدمن**.
- معالجة الأخطاء بوضوح (اسم مستخدم مكرّر، كلمة مرور قصيرة...).

**3. إصلاح الحسابات السابقة (one-shot)**
- تأكيد بريد المستخدم `af176cc4-...` (msarat1) عبر `auth.admin.updateUserById({ email_confirm: true })` ضمن نفس Edge Function عند الطلب، أو سكربت إصلاح يدوي يُشغَّل مرة واحدة.

**4. توضيح آلية الدخول للشركة**
- Username = ما يدخله الأدمن (مثل `masarat_express`).
- Password = ما يحدده الأدمن.
- شركة الشحن تذهب لـ `/login`، تكتب الـ username فقط (بدون @courier.sila.local — `Login.tsx` يُلحقه تلقائياً) وكلمة المرور → تُوجَّه إلى `/courier/orders`.

---

### تفاصيل تقنية

- **ملف جديد**: `supabase/functions/create-courier-account/index.ts`
- **ملف جديد**: `supabase/config.toml` — إضافة `[functions.create-courier-account] verify_jwt = true` (للتحقق أن المستدعي أدمن).
- **ملف معدّل**: `src/components/admin/AdminCouriersManagement.tsx` — استبدال منطق `handleCreateAccount`.
- **التحقق**: `npx tsc --noEmit` بعد التعديل.

النتيجة: الواجهة لن تختفي بعد الآن، والحساب الذي ينشئه الأدمن **سيعمل فوراً للدخول** بدون الحاجة لتأكيد بريد.

