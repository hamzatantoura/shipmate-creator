## الهدف

استبدال خوارزمية توليد رمز الشحنة بصيغة قوية تجمع: **عدم القابلية للتخمين + تجنّب الاصطدامات + كشف الأخطاء الإملائية**.

## التحليل الحالي

ثلاث خوارزميات مختلفة منتشرة في المشروع (تنتج رموزاً غير متّسقة وضعيفة):

| الموقع | الصيغة | المشكلة |
|---|---|---|
| `MerchantOrdersPage.tsx` `buildTrackingNumber()` | `SL-XXXXXX-YYYY` (6 hex من UUID + 4 عشوائية) | UUID prefix قابل للتخمين، `Math.random` غير آمن، لا checksum، لاحظنا اصطدام `324A8C` فعلياً |
| `ShipmentForm.tsx` السطر 390 | `SIL-{Date.now()}` | بادئة مختلفة، يمكن تخمينه من الوقت |
| DB trigger `create_shipment_for_order` | `SL-XXXXXX` فقط | لا فرادة، يتعارض مع UNIQUE constraint |

## الصيغة الجديدة

```text
SL-XXXXXXXX-C
   └────┬───┘ │
        │    └─ حرف تحقق (mod-31)
        └────── 8 أحرف عشوائية مشفّرة (crypto.getRandomValues)

أبجدية آمنة (31 حرف): ABCDEFGHJKMNPQRSTUVWXYZ23456789
            (مستثنى: 0, 1, I, L, O — للحدّ من الالتباس البصري)

مساحة الرموز: 31⁸ ≈ 8.5×10¹¹  (احتمال اصطدام ~0)
```

### الخصائص

1. **غير قابل للتخمين**: لا علاقة بأي UUID أو timestamp. مصدر العشوائية = `crypto.getRandomValues` في الواجهة و `gen_random_bytes` في PostgreSQL.
2. **بدون اصطدامات**: مساحة 850 مليار + UNIQUE constraint قائم + إعادة محاولة ذرية عند الاصطدام النادر.
3. **مقاوم للأخطاء الإملائية**: حرف التحقق mod-31 يكتشف فوراً أي حرف مفقود/خاطئ قبل ضرب قاعدة البيانات (يُرجع `invalid_code`).
4. **مقروء بشرياً**: الاستبعادات تمنع الخلط بين 0/O و 1/I/L.

## الملفات المتأثرة

### 1. ملف جديد — `src/features/shipments/lib/sila-code.ts`

دوال موحّدة (مصدر واحد للحقيقة):
- `generateSilaCode(): string` — يولّد رمزاً جديداً بالصيغة الكاملة.
- `validateSilaCode(code: string): boolean` — يتحقق من الصيغة و الـ checksum.
- `normalizeSilaCode(code: string): string` — تحويل لأحرف كبيرة + إزالة المسافات.

### 2. تحديث المواقع الثلاثة لاستخدام الدالة الموحّدة

- `src/features/merchant/pages/MerchantOrdersPage.tsx` — حذف `buildTrackingNumber` و استخدام `generateSilaCode()`.
- `src/features/shipments/components/ShipmentForm.tsx` — السطر 390 يستخدم `generateSilaCode()` بدلاً من `SIL-${Date.now()}`.
- `src/features/tracking/pages/TrackOrderPage.tsx` — تحقق فوري من checksum قبل إرسال الطلب لقاعدة البيانات (تجربة مستخدم أفضل).

### 3. Migration جديد

- إضافة دالة plpgsql `public.generate_sila_code()` بنفس الخوارزمية لاستخدامها في DB trigger، مع حلقة retry عند الاصطدام (حد أقصى 5 محاولات).
- تحديث `create_shipment_for_order` لاستخدام `generate_sila_code()` بدلاً من `SL-XXXXXX`.
- تحديث `track_order_by_sila_code` لإضافة فحص checksum قبل البحث + إبقاء التوافق مع الشحنات القديمة (مطابقة كاملة على `tracking_number`).

### 4. الشحنات القديمة

تبقى كما هي بصيغتها الحالية (`SL-EE9864-SRNI` … إلخ). دالة التتبع تطابقها بالنص الكامل تماماً — لا حاجة لإعادة توليد.

## أمثلة قبل/بعد

```text
قديم:  SL-EE9864-SRNI         (يتسرب أول 6 hex من UUID)
جديد:  SL-K7M3X9PA-Q          (عشوائي تماماً + checksum)

اختبار checksum:
  المستخدم يكتب: SL-K7M3X9PB-Q   ← invalid_code (حرف واحد مختلف، يُكتشف فوراً)
  المستخدم يكتب: SL-K7M3X9PA     ← invalid_code (checksum مفقود)
```

## تحقق ما بعد التطبيق

1. إنشاء طلب جديد → الشحنة تحصل على رمز بصيغة `SL-XXXXXXXX-X`.
2. لصق الرمز كاملاً في `/track` → يعرض الطلب.
3. تغيير حرف واحد → "لم نجد طلباً بهذا الرمز".
4. لصق رمز شحنة قديم `SL-EE9864-SRNI` → لا يزال يعمل.
