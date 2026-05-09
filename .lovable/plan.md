
## الهدف

تحويل بنية Sila الحالية (تنظيم حسب نوع الملف) إلى بنية **Feature-First** احترافية مستوحاة من معايير SaaS الكبرى، مع الحفاظ التام على:
- جميع المسارات (`/merchant/*`, `/courier/*`, `/admin/*`, إلخ)
- منطق العمل (محرك التسعير، المحفظة، تسلسل حالات الطلبات)
- مخطط قاعدة البيانات وسياسات RLS

## ⚠️ ملاحظة مهمة قبل التنفيذ

هذا تغيير كبير على ~80 ملف. سيُنفَّذ على **3 مراحل منفصلة** كل واحدة قابلة للحفظ والمراجعة:

| المرحلة | النطاق | الحجم |
|---|---|---|
| **1** | بنية المجلدات + نقل الملفات + تحديث الاستيرادات | كبيرة (تغيير مسارات) |
| **2** | استخراج المكونات المشتركة + توحيد الـ hooks | متوسطة |
| **3** | إدارة الحالة (React Query layer) + types موحدة | متوسطة |

ستحفظ نقطة استرجاع قبل كل مرحلة. **الخطة الحالية تغطي المرحلة 1 فقط** — وبعد إتمامها تظهر المراحل التالية كخطط مستقلة.

---

## المرحلة 1: البنية الجديدة (Feature-First Architecture)

### البنية المستهدفة

```text
src/
├── app/                          # نقطة الدخول والتوجيه
│   ├── App.tsx                   # (المنقول من src/App.tsx)
│   ├── router.tsx                # تعريف Routes منفصل
│   └── providers.tsx             # QueryClient + Auth + Tooltip + Toaster
│
├── features/                     # كل وحدة عمل في مجلدها
│   ├── auth/
│   │   ├── pages/                # Login, Signup, ForgotPassword, ResetPassword
│   │   ├── components/           # AuthForm, AuthGuard
│   │   ├── hooks/                # use-auth.tsx
│   │   └── index.ts              # public API للـ feature
│   │
│   ├── merchant/
│   │   ├── pages/                # Dashboard, Orders, Archive, Wallet, Products, Settings, TopUp
│   │   ├── components/           # MerchantSidebar, MerchantBottomNav, MerchantLayout, MerchantOrders, MerchantProducts, MerchantWallet, KycCard, VerificationGate, ShippingSettings, EditOrderDialog, ShipmentTrackingTimeline, StoreReadinessBanner
│   │   ├── hooks/                # use-merchant-id, use-merchant-verification
│   │   └── index.ts
│   │
│   ├── courier/                  # (الـ vendor role)
│   │   ├── pages/                # CourierOrders, CourierWallet
│   │   ├── components/           # CourierWalletPanel, BarcodeScanner
│   │   └── index.ts
│   │
│   ├── admin/
│   │   ├── pages/                # AdminLogistics, AdminSettlements, AdminSettings, AdminPayouts
│   │   ├── components/           # AnalyticsDashboard, AuditLog, BranchesManagement, CouriersManagement, DistrictsManagement, MerchantApproval, WhatsappQueue, CourierBranchesPanel, CourierPricingTiers
│   │   └── index.ts
│   │
│   ├── shipments/                # منطق الشحنات المشترك بين merchant/courier
│   │   ├── components/           # ShipmentForm, ShipmentTable
│   │   ├── lib/                  # order-locking, order-status, print-label, print-bulk, print-validation, shipping-label
│   │   └── index.ts
│   │
│   ├── storefront/               # المتجر العام
│   │   ├── pages/                # Storefront, ProductPage, ReviewOrderPage
│   │   └── index.ts
│   │
│   ├── tracking/
│   │   ├── pages/                # TrackOrderPage, TrackShipment
│   │   └── index.ts
│   │
│   └── wallet/                   # محرك المحفظة المشترك
│       ├── components/           # WalletTransactionsLog
│       ├── lib/                  # pricing-engine
│       └── index.ts
│
├── shared/                       # أدوات مستخدمة عبر features
│   ├── components/
│   │   ├── ui/                   # shadcn (كما هو)
│   │   ├── layout/               # AppHeader
│   │   ├── feedback/             # ErrorBoundary, NotificationBell
│   │   └── inputs/               # LocationPicker, SyrianPhoneInput, StarRating, SecureReceiptImage
│   ├── hooks/                    # use-mobile, use-toast, use-platform-settings, use-pwa-install, use-realtime-notifications
│   ├── lib/                      # utils, syrian-phone, image-compress, offline-sync, storage-helpers
│   └── types/                    # (فارغ الآن — يُملأ في المرحلة 3)
│
├── integrations/
│   └── supabase/                 # كما هو (auto-generated، ممنوع المساس)
│
├── assets/
├── data/
├── test/
├── index.css
├── main.tsx                      # يستورد من app/App
└── vite-env.d.ts
```

### قواعد البنية

1. **Public API لكل feature**: كل feature يصدّر فقط ما يحتاجه الخارج عبر `index.ts`. مثال:
   ```ts
   // features/merchant/index.ts
   export { default as MerchantDashboard } from "./pages/MerchantDashboard";
   export { default as MerchantLayout } from "./components/MerchantLayout";
   ```
2. **لا استيراد عرضي بين features**: لو احتاج merchant مكوناً من courier، يُنقل المكون إلى `shared/` أو إلى feature ثالث (مثل `shipments`).
3. **`shared/` للأدوات المشتركة فقط** — لا يحتوي منطق عمل.
4. **alias مختصرة في tsconfig**:
   ```json
   "@app/*": ["./src/app/*"],
   "@features/*": ["./src/features/*"],
   "@shared/*": ["./src/shared/*"],
   "@/*": ["./src/*"]   // يبقى للتوافق
   ```

### ما سيتغير فعلياً

| الملف القديم | الملف الجديد |
|---|---|
| `src/App.tsx` | `src/app/App.tsx` (مع استخراج Router و Providers) |
| `src/pages/Login.tsx` | `src/features/auth/pages/Login.tsx` |
| `src/pages/Merchant*.tsx` (7 ملفات) | `src/features/merchant/pages/*.tsx` |
| `src/components/merchant/*` | `src/features/merchant/components/*` |
| `src/components/admin/*` | `src/features/admin/components/*` |
| `src/components/courier/*` + `src/components/vendor/*` | `src/features/courier/components/*` |
| `src/components/AuthGuard.tsx`, `AuthForm.tsx` | `src/features/auth/components/*` |
| `src/hooks/use-auth.tsx` | `src/features/auth/hooks/use-auth.tsx` |
| `src/hooks/use-merchant-*.ts` | `src/features/merchant/hooks/*` |
| `src/lib/order-*.ts`, `print-*.ts`, `shipping-label.ts` | `src/features/shipments/lib/*` |
| `src/lib/pricing-engine.ts` | `src/features/wallet/lib/*` |
| `src/components/ShipmentForm.tsx`, `ShipmentTable.tsx` | `src/features/shipments/components/*` |
| `src/components/AppHeader.tsx` | `src/shared/components/layout/AppHeader.tsx` |
| `src/components/ErrorBoundary.tsx`, `NotificationBell.tsx` | `src/shared/components/feedback/*` |
| `src/components/LocationPicker.tsx`, `SyrianPhoneInput.tsx`, `StarRating.tsx`, `SecureReceiptImage.tsx` | `src/shared/components/inputs/*` |

### ما لن يتغير (مضمون)

- ✅ كل المسارات في `App.tsx` تبقى بنفس الـ paths
- ✅ ملفات `src/integrations/supabase/*` ممنوع المساس بها
- ✅ `src/components/ui/*` (shadcn) تبقى في مكانها — مجرد رابط alias جديد
- ✅ قاعدة البيانات وكل migrations
- ✅ منطق الأعمال داخل كل ملف يبقى حرفياً نفسه
- ✅ ملفات الاختبار `src/test/*`

### خطوات التنفيذ في المرحلة 1

1. إنشاء بنية المجلدات الجديدة (فارغة).
2. تحديث `tsconfig.app.json` بـ aliases الجديدة (مع إبقاء `@/*` للتوافق).
3. نقل الملفات بالمجموعات (auth → merchant → admin → courier → shipments → storefront → tracking → wallet → shared).
4. تحديث `import` داخل كل ملف منقول ليستخدم alias الجديدة.
5. إنشاء `index.ts` لكل feature.
6. استخراج `Router` و `Providers` من `App.tsx` إلى ملفات منفصلة.
7. تحديث `main.tsx` ليستورد من `@app/App`.
8. التحقق من عدم كسر أي شيء: تشغيل البناء + تصفح كل دور (merchant/courier/admin) للتأكد.

### المخاطر والتخفيف

- **خطر كسر استيرادات**: التخفيف عبر تنفيذ متسلسل بمجموعات صغيرة، وفحص بعد كل مجموعة.
- **خطر تضارب أسماء**: الأسماء الحالية فريدة، لا تضارب متوقع.
- **عمل غير ضروري**: لن نُعيد تسمية المكونات — فقط النقل.

---

## نظرة على المرحلتين 2 و 3 (للسياق فقط، تُنفَّذ لاحقاً)

### المرحلة 2: المكونات المشتركة وتوحيد الـ hooks
- استخراج `<DataTable>` عام بدل تكرار جداول الطلبات/الشحنات.
- استخراج `<PageHeader>` و `<EmptyState>` و `<StatCard>`.
- توحيد أنماط النماذج عبر `<FormField>` wrapper مع zod.
- توحيد use-supabase-query hook عام.

### المرحلة 3: طبقة إدارة الحالة و Types
- نقل كل استدعاءات Supabase إلى `features/*/api/*.ts` (data layer).
- بناء React Query hooks لكل feature (`useMerchantOrders`, `useCourierShipments`, إلخ).
- ملف `shared/types/` يصدّر types مشتقة من Supabase types مع types الأعمال (مثل `OrderStatus`, `ShipmentWithRelations`).
- إضافة optimistic updates للعمليات الشائعة.

---

## ما أحتاج تأكيدك عليه قبل الـ Implement

1. **هل توافق على بنية Feature-First المقترحة؟** أم تفضل بنية مختلفة (مثل Domain-Driven بطبقات)؟
2. **هل توافق على البدء بالمرحلة 1 فقط** (نقل ملفات بدون تعديل منطق)؟
3. **هل تريد إبقاء alias `@/*` القديم** للتوافق العكسي خلال الانتقال؟ (موصى به)
