---
name: Platform vision & features
description: Sila as Digital Commerce & Logistics Gateway (Salla model) for Syrian market - integrator not courier
type: feature
---
## Platform Vision
Sila (صلة) = Digital Commerce & Logistics Gateway for Syria (like Salla.sa)
Sila is NOT a courier company — it's the SOFTWARE INFRASTRUCTURE connecting merchants to shipping providers.

## Roles
Three roles: Admin, Merchant, Vendor.
Auth via Supabase Auth with profiles table. Role stored in profiles + user_roles tables.
Signup creates merchant by default. Admin/Vendor accounts created manually.

## Routes
- /login — Unified login page
- /signup — Merchant signup (store name, contact, phone, city)
- /merchant — Merchant Dashboard (orders, shipments, products, wallet, financial ledger) — auth-gated
- /vendor — Vendor Dashboard (assigned shipments, status control, COD log) — auth-gated
- /admin — Admin Dashboard (merchant accounts, trade volume, pricing, top-ups, payouts) — auth-gated
- /track — Public tracking page
- /topup — Merchant top-up page — auth-gated
- /pricing — Subscription plans page (UI only, no real payment)

## Key Concept
Sila is an INTEGRATOR — connects merchants to multiple shipping companies.
Merchants select shipping partners per shipment. Unified tracking dashboard.

## Revenue Model
- Subscription plans UI (Free/Basic/Pro) — no real payment yet
- Transaction fees / platform markup on each shipment

## Shipment Lifecycle
Statuses: pending_pickup → at_warehouse → in_transit_intercity → with_distributor → delivered | returned
Status history logged in shipment_status_history table.
Admin and Vendor can update statuses.

## Financial Engine
- Shipment creation: deducts shipping_fee from merchant wallet
- Delivered: +COD to wallet, -shipping_fee - 2,000 SYP hidden markup
- Returned: -5,000 SYP fixed return fee
- Hidden platform markup: 2,000 SYP (not shown to merchant)
