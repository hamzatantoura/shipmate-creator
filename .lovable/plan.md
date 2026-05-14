# خطة: نظام مصادقة احترافي عالي الجودة

## النطاق
ترقية صفحات `Login` / `Signup` / `ForgotPassword` / `ResetPassword` لتجربة بمستوى Stripe/Apple، مع تشديد الأمان وتفعيل تحقق البريد + Google OAuth.

---

## 1. الأمان والمنطق (Supabase Auth)

### تحقق البريد الإلكتروني (Email Verification)
- **إيقاف auto_confirm** عبر `configure_auth` (auto_confirm_email=false) ليُجبر المستخدم على تأكيد بريده.
- في `Signup`: بعد `signUp`، إن كان `data.user && !data.session` → عرض شاشة "تحقق من بريدك" + زر إعادة الإرسال (`resend`).
- في `AuthGuard`: التحقق من `user.email_confirmed_at` — إن كان `null` يُعاد التوجيه إلى صفحة `/verify-email` (جديدة) بدل لوحة التحكم.
- استثناء: حسابات `vendor` (شركات الشحن) تستخدم username وهمي — لا يُطبق عليها فحص تأكيد البريد.

### تفعيل HIBP وحماية كلمة المرور
- تشغيل `password_hibp_enabled=true` لرفض كلمات المرور المسربة.

### التحقق من النموذج (Validation)
- إضافة **Zod schemas** في `src/features/auth/lib/auth-schemas.ts`:
  - Email: تنسيق صحيح + ≤255
  - Password: ≥8، يحتوي على حرف ورقم على الأقل (regex)
  - Confirm password: مطابقة
- استخدام `react-hook-form` + `zodResolver` (المشروع يحوي `@hookform/resolvers` و `react-hook-form` أصلاً).
- الخادم: `password_hibp_enabled` + سياسة Supabase الافتراضية (طول 8) كطبقة ثانية.

### حماية المسارات
- `/dashboard` غير موجود حالياً (المسار هو `/merchant/dashboard`). سأضيف توجيه `/dashboard → /merchant/dashboard` ضمن `AuthGuard`، ويبقى `AuthGuard` يحمي كل المسارات الداخلية كما هو.
- إضافة فحص `email_confirmed_at` كما ذُكر أعلاه.

### حالات التحميل
- جميع أزرار النماذج تستخدم `disabled={loading}` مع `Loader2` (موجود جزئياً) — توحيد عبر مكوّن `AuthSubmitButton`.

---

## 2. تصميم UI/UX المميز (Glass-morphism)

### تصميم البطاقة
- بطاقة موسطة `max-w-md`, `rounded-2xl`, `shadow-2xl`, `backdrop-blur-xl`, `bg-card/60 border border-border/40`.
- خلفية متدرجة ناعمة (تستخدم HSL tokens من `index.css`): radial + linear gradient بألوان `--primary/10` و `--background`.
- شعار صلة في الأعلى داخل دائرة مضيئة (glow ring).

### الخط
- المشروع يستخدم Readex Pro (عربي) + Inter (إنكليزي) — سنحافظ عليهما (لا نخالف ذاكرة المشروع).

### التفاعلات
- **انتقال سلس Login ↔ Signup**: استخدام `framer-motion` لتبديل forms مع `AnimatePresence` (fade + slide).
- **Password toggle**: زر `Eye/EyeOff` داخل حقل كلمة المرور، مكوّن مشترك `PasswordInput`.
- **Focus rings ملوّنة بالـ primary**، تأثير hover ناعم على الأزرار (glow-btn موجود).

### الإشعارات
- `sonner` (مستخدم أصلاً) مع رسائل عربية واضحة:
  - نجاح: "تم إرسال رابط التأكيد إلى بريدك"
  - خطأ: ترجمة أخطاء Supabase الشائعة لرسائل عربية مفهومة

### الاستجابة (Responsive)
- Mobile-first: `p-4 sm:p-6`, البطاقة `w-full max-w-md`
- اختبار على 375px / 768px / 1280px

---

## 3. لمسات احترافية إضافية

### نسيت كلمة المرور
- صفحات `ForgotPassword` و `ResetPassword` موجودة — سيتم إعادة تصميمها بنفس glass-morphism وتوحيد منطق التحقق (zod).

### Google Social Login
- استدعاء `configure_social_auth` مع `providers: ["google"]`.
- زر "المتابعة عبر Google" بتصميم متّسق (أيقونة + خلفية بيضاء/داكنة حسب الثيم).
- استخدام `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`.
- بعد العودة: قراءة `role` من `user_roles` وتوجيه حسب الدور (admin/merchant/vendor). مستخدمو Google الجدد يُمنحون دور `merchant` تلقائياً (موجود في trigger `handle_new_user`).

---

## التغييرات التقنية (الملفات)

```text
جديد:
  src/features/auth/lib/auth-schemas.ts          # Zod schemas
  src/features/auth/components/AuthCard.tsx      # Glass-morphism wrapper
  src/features/auth/components/PasswordInput.tsx # حقل + eye toggle
  src/features/auth/components/GoogleAuthButton.tsx
  src/features/auth/pages/VerifyEmail.tsx        # شاشة "تحقق من بريدك"
  src/integrations/lovable/...                   # يُولَّد تلقائياً عبر configure_social_auth

معدّل:
  src/features/auth/pages/Login.tsx              # إعادة تصميم + zod + framer-motion
  src/features/auth/pages/Signup.tsx             # نفس الشيء + التحقق من البريد
  src/features/auth/pages/ForgotPassword.tsx     # توحيد التصميم
  src/features/auth/pages/ResetPassword.tsx      # توحيد التصميم
  src/features/auth/components/AuthGuard.tsx     # فحص email_confirmed_at
  src/app/router.tsx                             # +/verify-email، +/dashboard redirect
  src/index.css                                  # طبقة gradient الخلفية للمصادقة (إن لزم)

استدعاءات أدوات (قبل الكود):
  configure_auth(auto_confirm_email=false, password_hibp_enabled=true, disable_signup=false, external_anonymous_users_enabled=false)
  configure_social_auth(providers=["google"])
```

---

## أسئلة قبل التنفيذ

1. **تأكيد البريد إلزامي**: هل تريد فعلاً إيقاف auto-confirm؟ (هذا يعني أن المستخدمين الحاليين الذين لم يؤكدوا لن يتمكنوا من الدخول حتى يؤكدوا — نادر لكن مهم).
2. **Google Login**: هل يُسمح بدخول التجار عبر Google فقط؟ (شركات الشحن ستبقى username/password لأن لها edge function خاص).
3. **نطاق التغيير**: هل أعيد تصميم صفحات `ForgotPassword/ResetPassword` بنفس الأسلوب أم تكتفي بـ Login/Signup الآن؟

