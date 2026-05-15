
## الهدف
تحويل بانر "تعيين كلمة المرور" من اقتراح اختياري إلى **خطوة إجبارية** بعد أول تسجيل دخول للتاجر عبر Google، بحيث لا يستطيع استخدام المنصة قبل تعيين كلمة مرور لحسابه.

## السلوك المطلوب
- تاجر دخل لأول مرة عبر Google → يُعرض له شاشة/حوار إجباري لتعيين كلمة مرور.
- لا يمكن إغلاق الحوار أو تخطّيه (لا زر "لاحقاً"، لا dismiss).
- بعد تعيين كلمة المرور بنجاح → يُحدَّث `auth_provider` إلى `google+password` ويُسمح له بالمتابعة.
- التاجر الذي سجّل أصلاً عبر البريد/كلمة المرور → لا يرى هذه الشاشة.
- التاجر الذي عيّن كلمة مرور سابقاً → لا يراها مجدداً.
- يبقى دخول Google يعمل بشكل طبيعي بعد التعيين (الحساب مرتبط بنفس البريد).

## التغييرات

### 1. حارس جديد: `RequirePasswordGate`
ملف جديد: `src/features/auth/components/RequirePasswordGate.tsx`
- يفحص `profile.auth_provider === "google"` (أي لم يُعيَّن كلمة مرور بعد).
- إن كان كذلك، يعرض `Dialog` غير قابل للإغلاق (بدون `X`، `onOpenChange` معطّل، الضغط خارج الحوار لا يغلقه) يحتوي نموذج تعيين كلمة المرور (نفس منطق `MerchantSecurityCard` الحالي مبسطاً).
- بعد النجاح: يستدعي `supabase.auth.updateUser({ password })`، ثم يحدّث `merchants.auth_provider = 'google+password'`، ثم يعيد تحميل البروفايل ويغلق الحوار.
- يعرض رسالة توضيحية: "لحماية حسابك، يجب تعيين كلمة مرور قبل المتابعة. ستتمكن من الدخول لاحقاً عبر Google أو البريد + كلمة المرور."

### 2. تركيب الحارس داخل `AuthGuard`
في `src/features/auth/components/AuthGuard.tsx`:
- بعد تجاوز فحوصات `email_confirmed_at` و `needs_onboarding`، وقبل عرض `children`، نلفّ المحتوى بـ `<RequirePasswordGate>` للتجار فقط (`role === 'merchant'`).
- بهذا يظهر الحوار فوق أي صفحة تاجر يحاول الوصول إليها.

### 3. حذف/تعطيل البانر الاختياري
- إزالة `<SetPasswordBanner />` من `MerchantDashboard.tsx` (لم يعد ضرورياً لأن الإجبار يحصل قبل الوصول).
- يمكن الإبقاء على `MerchantSecurityCard` في صفحة الإعدادات لتغيير كلمة المرور لاحقاً.

### 4. شرط `auth_provider`
نعتمد على القيمة الموجودة في جدول `merchants` (الحقل موجود حالياً وفق التغييرات السابقة):
- `google` → لم يُعيِّن كلمة مرور بعد → الحوار إجباري.
- `email` أو `google+password` → لا حوار.

لا حاجة لتغييرات قاعدة بيانات.

## ملاحظات أمنية
- تعيين كلمة المرور لا يفصل ربط Google؛ كلا الطريقتين تعملان لنفس الحساب (مرتبطتان بالبريد).
- نستخدم نفس متطلبات قوة كلمة المرور المعتمدة في النظام (`PasswordStrengthMeter` إن وُجد).

## الملفات المتأثرة
- جديد: `src/features/auth/components/RequirePasswordGate.tsx`
- تعديل: `src/features/auth/components/AuthGuard.tsx`
- تعديل: `src/features/merchant/pages/MerchantDashboard.tsx` (إزالة البانر)
- (اختياري) حذف: `src/features/merchant/components/SetPasswordBanner.tsx`
