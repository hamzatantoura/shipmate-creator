# إصلاح تداخلات العرض (Visual Tearing) في بوابة شركة الشحن

## السبب الحقيقي

التداخلات الملوّنة الأفقية الظاهرة في الصورة ليست خطأ في المتصفح ولا بسبب عدد التبويبات المفتوحة — هي خلل شائع جداً في محرّك العرض (compositor) في Chrome/Android يحدث عندما يجتمع:

1. عنصر `position: sticky` (الهيدر العلوي والشريط السفلي للموبايل)،
2. مع `backdrop-blur` (تأثير ضبابي على الخلفية)،
3. مع تمرير (scroll) لمحتوى أسفله،
4. مع عناصر `animate-pulse` ورسم بياني (Recharts) داخل المنطقة المُمرَّرة.

النتيجة: الـ GPU لا يُحدّث الـ tile الخاص بالخلفية بشكل صحيح أثناء التمرير، فتظهر "خطوط مهلهلة" ملونة فوق المحتوى. يحصل هذا تحديداً في:

- `CourierDashboard.tsx` (السطر 227): `sticky top-0 ... bg-background/85 backdrop-blur`
- `CourierDashboard.tsx` (السطر 304): شريط الموبايل السفلي `fixed ... bg-background/95 backdrop-blur`
- `CourierOrders.tsx` (السطر 855): `sticky top-0 ... bg-card/95 backdrop-blur`

التشخيص يطابق الأعراض في صورتك: المنطقة المُشوَّهة تبدأ مباشرة تحت الهيدر، تمتد طوال المحتوى، وتختفي على بطاقات معينة (مثل بطاقة "مرتجع") — لأن البطاقات الصلبة فوق نفسها لا تتأثر.

## الحل

إلغاء `backdrop-blur` وجعل خلفية الهيدر والشريط السفلي **معتمة 100%** (بدون شفافية)، مع الإبقاء على الحدّ السفلي. هذا يحلّ المشكلة جذرياً دون التأثير على الشكل الجمالي (الفرق البصري شبه معدوم لأن الخلفية أصلاً قاتمة جداً).

## التغييرات

1. **`src/features/courier/pages/CourierDashboard.tsx`**
   - السطر 227: `bg-background/85 backdrop-blur` → `bg-background`
   - السطر 304 (الشريط السفلي): `bg-background/95 backdrop-blur` → `bg-background`

2. **`src/features/courier/pages/CourierOrders.tsx`**
   - السطر 855: `bg-card/95 backdrop-blur` → `bg-card`

3. إضافة `will-change: transform` و `transform: translateZ(0)` للهيدر لتثبيت طبقة العرض ومنع أي rendering glitches متبقية.

4. (احتياطي) إضافة `isolation: isolate` على `<main>` لعزل سياق الـ stacking ومنع تسرّب أي blur من طبقات أخرى.

## ملاحظات

- لن يُغيَّر أي منطق وظيفي (queries, mutations, RLS) — فقط CSS classes في طبقتين.
- التغيير ينطبق تلقائياً على الموبايل والديسكتوب.
- سأتحقق بعد التطبيق من اختفاء التداخل عبر التقاط لقطة شاشة جديدة (إن أمكن في وضع البناء).
