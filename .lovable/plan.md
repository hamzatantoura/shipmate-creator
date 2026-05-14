## Context

The platform already has a full pending-approval pipeline that maps 1:1 to your "is_approved" idea — no new boolean is needed:

- `merchants.verification_status`: `pending_verification` → `pending_admin_approval` → `verified` (or `rejected`)
- `MerchantVerificationGate` currently **blocks the entire dashboard** for non-verified merchants
- `AdminMerchantApproval` already lets admins flip the status to `verified`
- Profile/KYC fields, logo upload, warehouse address, etc. already exist on the `merchants` table

What's missing is exactly what you're asking for: a **softer permission model** (let unverified merchants explore most of the app, only block shipment creation), plus the educational UX (onboarding tour, persistent banner, progress tracker).

So instead of duplicating the system with a new `is_approved` column, this plan adapts the existing one.

## What changes

### 1. Permission model (relaxed gate)

Replace today's "block everything" `MerchantVerificationGate` with a per-action policy driven by `verification_status === 'verified'`:

| Area | Pending merchant | Verified merchant |
|---|---|---|
| Dashboard (KPIs, banner, progress) | Allowed | Allowed |
| Settings / Profile / KYC upload | Allowed | Allowed |
| Products list + Add Product | Allowed (`is_active=false` forced — "Draft") | Allowed (`is_active=true`) |
| Orders list (read) | Allowed | Allowed |
| **Create Shipment / Print Waybill / Bulk import** | **Disabled with tooltip** "متاحة بعد تفعيل الحساب" | Allowed |
| Storefront (public) | Hidden until verified (already enforced by existing anon RLS) | Visible |

Add a hook `useMerchantApproval()` returning `{ isApproved, status, lockMessage }` used by every action button. Wrap `<Button disabled>` in a Tooltip when `!isApproved`.

The existing `MerchantVerificationGate` is repurposed to wrap **only** the Shipments page (`MerchantShipments` create form) and the bulk-print bar — not the entire dashboard, products, or settings pages.

### 2. Persistent status banner

New `<MerchantApprovalBanner />` rendered at the top of `MerchantLayout` (above page content) whenever `verification_status !== 'verified'`. Variants:

- `pending_verification`: yellow — "حسابك قيد المراجعة. أكمل بياناتك وأضف منتجاتك ريثما يتم تفعيله."
- `pending_admin_approval`: blue — "تم استكمال البيانات. بانتظار اعتماد الإدارة لتفعيل الشحن."
- `rejected`: red — "تم رفض حسابك. راجع البيانات وأعد التقديم."

Includes a mini progress chip ("جاهزية الحساب: 60%") linking to Settings.

### 3. First-login onboarding tour

New `<MerchantOnboardingTour />` mounted inside `MerchantLayout`. A 4-step Shadcn `Dialog` stepper shown **once** (flag stored in `localStorage` keyed by `user.id`):

1. أهلاً بك في صلة — كيف تعمل المنصة (سطر مختصر + أيقونة)
2. أكمل ملف المتجر (شعار، اسم، تواصل، عنوان مستودع)
3. أضف منتجاتك (تُحفظ كمسودة حتى التفعيل)
4. بانتظار التفعيل — سنُعلِمك فور موافقة الإدارة

Uses existing UI tokens (Readex Pro, primary orange #FF8C00, dark navy bg). Skippable, replayable from the banner via "إعادة عرض الجولة".

### 4. Readiness progress tracker

New `<MerchantReadinessProgress />` card on the dashboard. Reuses the checks already returned by `useMerchantVerification()`:

```text
[████████░░] 80% جاهز للإطلاق
✓ الملف الشخصي    ✓ المنتجات (3)
✓ شعار المتجر     ○ الموافقة الإدارية
```

Weighted: profile 40% / KYC docs 30% / at least 1 product 20% / admin approval 10%. Pure UI from existing data — no new query.

### 5. Product drafts during pending

In `MerchantProducts.tsx`, when `!isApproved` force `is_active = false` on insert/update (UI shows a locked "مسودة" badge with tooltip). When the merchant becomes `verified`, an opt-in toast offers "تفعيل كل المسودات".

### 6. Admin notifications

Already partly wired (`AdminMerchantApproval` shows a destructive badge with the pending count). Add a database trigger so a row is **inserted into `notifications`** for every admin (`user_roles.role='admin'`) when:

- a new `merchants` row is created → "تاجر جديد بانتظار التحقق"
- `verification_status` flips to `pending_admin_approval` → "تاجر جاهز للاعتماد"

Linked to `/admin?tab=merchants` so the admin lands directly on the approval table.

## Files

**Create**
- `src/features/merchant/hooks/use-merchant-approval.ts` — thin wrapper around `useMerchantVerification` exposing `{ isApproved, lockMessage }`
- `src/features/merchant/components/MerchantApprovalBanner.tsx`
- `src/features/merchant/components/MerchantOnboardingTour.tsx`
- `src/features/merchant/components/dashboard/MerchantReadinessProgress.tsx`
- `src/features/merchant/components/LockedActionButton.tsx` — shared `<Button>` + `<Tooltip>` wrapper

**Edit**
- `src/features/merchant/components/MerchantLayout.tsx` — mount banner + tour
- `src/features/merchant/components/MerchantVerificationGate.tsx` — narrow scope (only used for shipment creation)
- `src/features/merchant/pages/MerchantDashboard.tsx` — add readiness card, drop hard lock alert (banner replaces it)
- `src/features/merchant/pages/MerchantProductsPage.tsx` — remove gate wrapper, allow access
- `src/features/merchant/components/MerchantProducts.tsx` — force draft for pending merchants
- `src/features/merchant/pages/MerchantOrdersPage.tsx` + `MerchantShipments.tsx` — wrap create/print/bulk buttons with `LockedActionButton`

**Migration**
- Trigger on `merchants` insert + status update → insert rows into `notifications` for every admin user. No schema changes; uses existing tables.

## Out of scope

- No new `is_approved` column (existing `verification_status` covers it)
- No changes to RLS policies (current policies already prevent unverified merchants from receiving public orders)
- No email notifications (handled by the separate custom-email-domain plan)
