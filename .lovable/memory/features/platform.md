---
name: Platform Features
description: 3-tier multi-tenant logistics platform. Three roles: Admin, Merchant, Vendor. Auth-gated dashboards.
type: feature
---
## Roles
Three roles: Admin, Merchant, Vendor.
Auth via Supabase Auth with profiles table. Role stored in profiles + user_roles tables.
Signup creates merchant by default. Admin/Vendor accounts created manually.

## Routes
- /login — Unified login page
- /signup — Merchant signup (store name, contact, phone, city)
- /merchant — Merchant Dashboard (shipments, products, orders, wallet) — auth-gated
- /vendor — Vendor Dashboard (assigned shipments, status control, cash log) — auth-gated
- /admin — Admin Dashboard (shipment management, top-ups, payouts, stats) — auth-gated
- /track — Public tracking page
- /topup — Merchant top-up page — auth-gated

## Shipment Lifecycle
Statuses: pending_pickup → at_warehouse → in_transit_intercity → with_distributor → delivered | returned
Status history logged in shipment_status_history table.
Admin and Vendor can update statuses.

## Financial Engine
- Shipment creation: deducts shipping_fee from merchant wallet
- Delivered: +COD to wallet, -shipping_fee - 2,000 SYP hidden markup
- Returned: -5,000 SYP fixed return fee
- Hidden platform markup: 2,000 SYP (not shown to merchant)
