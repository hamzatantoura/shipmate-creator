## التغييرات

استبدال شعار شاحنة (Truck icon) في صفحات الـauth بشعار صلة الفعلي (`@/assets/sila-logo.png`) المستخدم في الواجهة الرئيسية.

### الملفات
1. **`src/features/auth/components/AuthBrandPanel.tsx`**
   - حذف استيراد `Truck` واستبداله بـ `import silaLogo from "@/assets/sila-logo.png"`.
   - استبدال أيقونة `Truck` ضمن مربع البراند بصورة `<img src={silaLogo} alt="Sila" className="h-8 w-8" />`.

2. **`src/features/auth/components/AuthCard.tsx`**
   - حذف استيراد `Truck` واستبداله بـ silaLogo.
   - استبدال أيقونة `Truck` في النسخة الموبايل (mobile brand mark) بـ `<img>` بنفس الأسلوب.

### النصوص
لا تغيير على النصوص — العنوان "صلة" والوصف "Sila Logistics" والـ headline والـ features كلها مناسبة بالفعل للمنصة.

لا تغييرات backend.