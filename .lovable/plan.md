# ترقية صفحات الدخول والهبوط — هوية "صلة" الاحترافية

## الهدف
رفع مستوى صفحات: **الهبوط Landing**، **تسجيل الدخول Login**، **إنشاء حساب Signup**، **استعادة كلمة المرور Forgot/Reset** لتصبح بنفس قوة وفخامة لوحات شركة الشحن (Courier Dashboard) — مع الحفاظ على نفس المنطق والوظائف الحالية بدون لمس قاعدة البيانات أو تدفق المصادقة.

## التشخيص الحالي
- `AuthCard.tsx` يستخدم Glass-morphism بسيط مع gradient واحد + أيقونة شاحنة.
- `Landing.tsx` صغيرة جداً (48 سطر) — مجرد بطاقة دخول، لا تعكس قوة المنصة.
- صفحات Login/Signup/Forgot/Reset كلها تتشارك نفس `AuthCard` الضيّق (max-w-md).
- لا يوجد عرض بصري للميزات أو الإحصائيات أو الثقة (Social proof).

## خطة التنفيذ

### 1. صفحة الهبوط Landing (إعادة بناء كاملة)
بنية جديدة احترافية مكوّنة من أقسام:
- **Hero مزدوج العمود**: عنوان قوي + CTA مزدوج (تسجيل تاجر / تسجيل شركة شحن) + رسم بياني/Mockup للوحة التحكم على اليمين مع توهج orange.
- **شريط الثقة**: عدّادات حيّة (عدد التجار، عدد الطلبات، شركات الشحن المعتمدة) — أرقام ثابتة في البداية.
- **Bento Grid للميزات**: 6 بطاقات بأحجام مختلفة (محفظة ذكية، تسعير حسب المنطقة، تتبّع لحظي، تكامل شركات الشحن، تقارير، API).
- **قسم "كيف يعمل"**: 3 خطوات بصرية للتاجر و3 لشركة الشحن (Tabs).
- **قسم شركات الشحن المعتمدة**: شعارات/بطاقات الناقلين الفعليين من DB.
- **CTA نهائي + Footer كامل**: روابط، سياسة، تواصل، لغة.

### 2. ترقية AuthCard المشترك
تطوير `AuthCard.tsx` إلى تخطيط **Split-Screen** على الشاشات الكبيرة:
- **العمود الأيمن (40%)**: النموذج نفسه داخل بطاقة Glass.
- **العمود الأيسر (60%)**: لوحة Brand فخمة تعرض:
  - شعار + شعار "صلة" بخط Display كبير.
  - 3 ميزات سريعة بأيقونات (Lucide).
  - Mockup صغير لإحصائية أو طلب نموذجي.
  - خلفية Mesh Gradient ديناميكية (Framer Motion) بألوان orange/navy.
- على الجوال: ينهار إلى عمود واحد (الشكل الحالي) للحفاظ على UX الموبايل.

### 3. تحسينات تجربة النماذج (Login/Signup/Forgot/Reset)
- **مؤشر قوة كلمة المرور** في Signup (ضعيفة/متوسطة/قوية) — UI فقط.
- **أيقونات داخل الحقول** (Mail, Lock, Eye toggle).
- **رسائل ترحيب ديناميكية** حسب الوقت (صباح الخير/مساء الخير).
- **Loading states أنيقة**: Skeleton + Spinner داخل الزر.
- **Animations متتالية** للحقول (stagger) عند الدخول.
- **أزرار اجتماعية محسّنة** (Google) بنفس وزن الزر الأساسي.

### 4. صفحة Reset Password
نفس التحسينات + شريط تقدّم بصري لخطوات الاستعادة (طلب → فحص بريد → كلمة جديدة → تم).

## ما لن يتغيّر
- منطق المصادقة في `use-auth.tsx` و`AuthForm.tsx` (validation, submit).
- سياسات RLS أو جداول قاعدة البيانات.
- التدفقات الأمنية (HIBP, email verification).
- مكوّن `AuthGuard` و`Router`.

## التفاصيل التقنية
- جميع الألوان من `index.css` tokens (`--primary`, `--background`, `--card`, `--muted`).
- خط `font-display` (Readex Pro) للعناوين، `font-body` (Inter) للنص.
- استخدام `framer-motion` للحركات (موجود مسبقاً).
- صور/Mockups مولّدة عبر `imagegen` بجودة `standard`.
- RTL محفوظ عبر `dir={meta.dir}` و`start/end` بدلاً من `left/right`.

## الملفات المتأثّرة
- **تعديل**: `AuthCard.tsx`, `Landing.tsx`, `Login.tsx`, `Signup.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`, `AuthForm.tsx`.
- **إنشاء**: `LandingHero.tsx`, `LandingFeatures.tsx`, `LandingHowItWorks.tsx`, `LandingCarriers.tsx`, `LandingFooter.tsx`, `AuthBrandPanel.tsx`, `PasswordStrengthMeter.tsx`.
- **أصول**: 1-2 صور/mockups في `src/assets/`.

## خارج النطاق
- أي تغيير في تدفق الموافقة (Pending Approval) المُنفّذ سابقاً.
- إعدادات إيميل/Domain.
- إضافة مزوّدي دخول جدد (Apple, Phone…).
