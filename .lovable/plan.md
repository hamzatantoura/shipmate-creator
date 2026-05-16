## ترقية واجهة المتجر إلى Micro-Store احترافي

تحويل صفحة المتجر العامة (`/store/:merchantId`) إلى واجهة على طراز Trendyol/Amazon، مع توسيع مدير المنتجات في لوحة التاجر.

---

### 1. تغييرات قاعدة البيانات (Migration واحدة)

**جدول `products`** — إضافة:
- `original_price NUMERIC` — السعر قبل الخصم (اختياري). `price` يبقى سعر البيع الفعلي.
- `in_stock BOOLEAN DEFAULT true` — مفتاح "متوفر/غير متوفر".
- `category TEXT` — تصنيف حر (ملابس، إلكترونيات، …).

**جدول `merchants`** — إضافة:
- `banner_url TEXT` — صورة الغلاف (Hero)
- `bio TEXT` — وصف قصير للمتجر
- `operating_hours TEXT` — ساعات العمل (نص حر)

(`logo_url` و `whatsapp_number` موجودان بالفعل.)

**جدول جديد `merchant_branches`:**
- `id`, `merchant_id`, `name`, `address`, `phone`, `whatsapp`, `is_primary`, timestamps
- RLS: التاجر يدير فروعه. عرض عام عبر view `merchant_branches_public` لفروع التجار المُفعّلين والمُوثّقين.

**RPC `get_public_merchant_info`** — توسيعها لإرجاع: `banner_url`, `logo_url`, `bio`, `operating_hours`, `whatsapp_number` (الهاتف يبقى مخفياً).

**Bucket تخزين `store-branding`** (عام، RLS: المالك يرفع داخل مجلده) للغلاف فقط (الشعار يستخدم bucket موجود).

### 2. واجهة المتجر العامة (`Storefront.tsx`) — إعادة بناء كاملة

```text
[ Hero Banner عرض كامل (h-48 موبايل / h-72 ديسكتوب) ]
   [ شعار دائري متراكب أسفل البانر ]
[ اسم المتجر • زر "معلومات المتجر" • زر "مشاركة" ]
[ Bio قصير ]
[ شريط تصنيفات أفقي قابل للتمرير (الكل + التصنيفات) ]
[ شبكة منتجات: 2 موبايل / 3 sm / 4 lg ]
```

- **زر مشاركة**: `navigator.share` مع fallback نسخ الرابط.
- **مودال معلومات المتجر**: قائمة الفروع (اسم، عنوان، روابط هاتف/واتساب)، ساعات العمل، روابط تواصل.
- **شريط التصنيفات**: مشتق من منتجات المتجر، sticky عند التمرير، RTL scroll-x.
- **بطاقة المنتج**:
  - صورة مع `hover-scale`
  - شارة خصم حمراء `-NN%` إذا `original_price > price`
  - عنوان (line-clamp-1)
  - سعر البيع بخط عريض + السعر الأصلي مشطوب
  - Overlay "غير متوفر" إذا `!in_stock`

### 3. مدير المنتجات للتاجر (`MerchantProducts.tsx`)

تعديلات النموذج:
- **رفع متعدد الصور**: معاينات مصغرة قابلة للحذف قبل الإرسال.
- **التسعير**: حقل "السعر الأصلي" (اختياري) + "سعر البيع". عرض نسبة الخصم المحسوبة تلقائياً.
- **التنوّعات (Variants)**: تفعيلها أيضاً في وضع التعديل (حالياً عند الإنشاء فقط).
- **التصنيف**: حقل نصي مع اقتراحات من تصنيفات التاجر السابقة.
- **حالة التوفر**: Switch لـ `in_stock`.

بطاقة المنتج في لوحة التاجر:
- شارة الخصم إذا انطبقت
- Switch سريع "إظهار/إخفاء" يحدّث `is_active`
- شارة "غير متوفر" عند الحاجة
- أزرار التعديل/الحذف/المشاركة كما هي

### 4. علامة تبويب "هوية المتجر" في الإعدادات

ضمن `MerchantSettingsPage.tsx`:
- رفع صورة الغلاف (16:9) والشعار (1:1) مع ضغط
- تعديل Bio، ساعات العمل
- إدارة الفروع (CRUD): الاسم، العنوان، الهاتف، الواتساب، تحديد الفرع الرئيسي

### 5. التصميم

- نظام التصاميم الحالي (semantic tokens) يدعم الوضعين الفاتح والداكن تلقائياً.
- RTL، خط Readex Pro للعربية.
- animations: `hover-scale`, `animate-fade-in` من tailwind config.
- Mobile-first، شريط تصنيفات sticky، مسافات بيضاء واسعة.

### 6. الملفات

**جديدة**
- `supabase/migrations/<timestamp>_micro_store.sql`
- `src/features/storefront/components/StoreHero.tsx`
- `src/features/storefront/components/StoreInfoDialog.tsx`
- `src/features/storefront/components/CategoryFilter.tsx`
- `src/features/storefront/components/StorefrontProductCard.tsx`
- `src/features/merchant/components/MerchantBrandingForm.tsx`
- `src/features/merchant/components/MerchantBranchesManager.tsx`

**مُعدَّلة**
- `src/features/storefront/pages/Storefront.tsx` (إعادة بناء)
- `src/features/merchant/components/MerchantProducts.tsx` (نموذج + بطاقة)
- `src/features/merchant/pages/MerchantSettingsPage.tsx` (تبويب الهوية)

### 7. خارج النطاق (اطلب إذا أردتها)

- سلّة شراء/checkout من المتجر (التدفق الحالي يمرّ بصفحة المنتج).
- متعدد اللغات للمتجر (عربي فقط حالياً).
- تقييمات المنتج على شبكة المتجر (موجودة في صفحة المنتج).
