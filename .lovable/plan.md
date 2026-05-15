## 1. Merchant product cards

In `MerchantProducts.tsx`:
- Replace silent `deleteProduct` with a confirmation modal (shadcn `AlertDialog`): "هل تريد حذف هذا المنتج نهائياً؟".
- On confirm: also remove storage files. Parse the storage path from `image_url` and `product_images[].image_url` (everything after `/product-images/`) and call `supabase.storage.from("product-images").remove([...paths])` before the soft-delete update.
- Redesign card to Amazon/Trendyol style: clean white surface (`bg-white text-zinc-900 border border-zinc-200 rounded-xl shadow-sm hover:shadow-md`), square image, bold price tag (orange chip), product title (line-clamp-2), small stock pill, and an action row with three icon buttons: **Edit** (pencil), **Copy link** (copy), **Delete** (trash, opens confirm). Keep the WhatsApp share as a secondary icon. Remove the dark muted background.

## 2. External website URL

- Migration: `ALTER TABLE merchants ADD COLUMN external_website_url text`.
- In `MerchantShippingSettings.tsx` (Store Settings section), add an `Input` with label "رابط الموقع الإلكتروني (اختياري)" and basic URL validation, save into `merchants.external_website_url`.
- On the public storefront, when present, show a button "زيارة الموقع الرسمي" with `ExternalLink` icon next to the store name.

## 3. Public storefront route `/s/:slug`

- Migration: ensure `profiles.store_slug` is unique (case-insensitive). Backfill from `store_name` for existing merchants; auto-generate on signup via trigger if null. Add route `/s/:slug` in `src/app/router.tsx` pointing to a new `PublicStorefront` page.
- New page `src/features/storefront/pages/PublicStorefront.tsx`:
  - Resolve slug → merchant via existing public RPC (extend `get_public_merchant_info` to accept slug, OR add `get_public_merchant_by_slug`). Returns only safe fields (store_name, city, logo_url, external_website_url, is_active, verification_status, user_id).
  - Hero header: logo, store name (large display), city, **Share** button (Web Share API + clipboard fallback), and "زيارة الموقع الرسمي" if set.
  - Product grid: large square images (aspect-square, `object-cover`), title, price, two CTAs per product:
    - **Buy via WhatsApp** → `https://wa.me/<merchant.whatsapp_number>?text=...` (only if number present).
    - **Request Details** → opens product detail page `/product/:slug`.
  - Mobile-first: 2 cols on mobile, 3 on md, 4 on lg. Lazy-load images, eager+priority for first 4.
  - SEO via existing `<Seo>` component: title, description, OG image (first product), JSON-LD `Store` + product list. Add canonical to `/s/<slug>`.
- Keep existing `/store/:merchantId` working as a redirect to `/s/:slug` when slug exists.

## 4. RLS / data access

Public read access already exists in safe form:
- `products`: anon SELECT where `is_active=true AND deleted_at IS NULL` ✓
- `product_images`: public SELECT ✓
- `merchants`: NOT directly readable by anon — keep it that way and continue using a security-definer RPC that returns only safe public columns (add `external_website_url`, `logo_url`, `whatsapp_number`, `store_slug`).
- Add anon policy on `profiles` ONLY for `store_slug` lookup is unnecessary if we use the RPC; do slug → user_id resolution inside the RPC.

## 5. Files touched

- DB migration (new): merchants column + RPC update + slug uniqueness/backfill.
- `src/features/merchant/components/MerchantProducts.tsx` — confirm dialog, storage cleanup, card redesign.
- `src/features/merchant/components/MerchantShippingSettings.tsx` — external website field.
- `src/app/router.tsx` — `/s/:slug` route.
- `src/features/storefront/pages/PublicStorefront.tsx` — new page.
- `src/features/storefront/index.ts` — export.

No changes to financial engine, courier logic, or order flow.
