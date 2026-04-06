
# Sila — 3-Tier Multi-Tenant Logistics Platform

## Phase 1: Database & Auth
1. **Create `profiles` table** — store_name, contact_person, phone, city, role (admin/merchant/vendor)
2. **Create `user_roles` table** with enum (admin, merchant, vendor)
3. **Enable Supabase Auth** with email/password (no auto-confirm)
4. **Update RLS policies** on all tables to use auth.uid() instead of anon access
5. **Add trigger** to auto-create profile on signup

## Phase 2: Auth Pages
1. **Login page** (`/login`) — unified login, redirects based on role
2. **Merchant signup** (`/signup`) — Store Name, Contact Person, Phone, City
3. **Auth guard wrapper** — protects all dashboard routes

## Phase 3: Merchant Dashboard (`/merchant`)
- Refactor existing MerchantPortal to use auth user_id instead of localStorage
- Tabs: Shipments (form + table + print waybill), Wallet (pending/available)
- Filter shipments by authenticated merchant_id

## Phase 4: Vendor Dashboard (`/vendor`)
- New page showing only shipments assigned to this vendor (via carrier_id)
- Status dropdown: picked_up, out_for_delivery, delivered, rejected
- Cash log: confirm COD collected per delivery

## Phase 5: Admin Dashboard (`/admin`)
- Refactor existing AdminLogistics
- Global stats: total orders, revenue, active vendors
- Order routing: assign pending shipments to vendors
- Pricing table: edit shipping rates per governorate

## Phase 6: Visual Identity
- Strict Navy (#0F172A) + Turquoise (#00E5FF) + White/Grey only
- Remove any remaining gold/green/orange
- High-tech glow effects on turquoise buttons
- 100% RTL with Readex Pro
- Grid line backgrounds on dashboards

## Files to create/modify:
- New: `/src/pages/Login.tsx`, `/src/pages/Signup.tsx`, `/src/pages/VendorDashboard.tsx`
- New: `/src/components/AuthGuard.tsx`, `/src/hooks/use-auth.ts`
- Modify: `App.tsx`, `MerchantPortal.tsx`, `AdminLogistics.tsx`, `Landing.tsx`, `index.css`
- Modify: `use-merchant-id.ts` → replace with auth-based merchant ID
