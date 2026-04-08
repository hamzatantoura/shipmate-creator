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
- /merchant — Merchant Dashboard (orders, shipments, products, wallet) — auth-gated
- /vendor — Vendor Dashboard (assigned shipments, status control, COD log, operations map) — auth-gated
- /admin — Admin Dashboard (merchant accounts, trade volume, pricing, top-ups, payouts) — auth-gated
- /track — Public tracking page
- /topup — Merchant top-up page — auth-gated
- /store/:merchantId — Public storefront for each merchant
- /product/:slug — Public product page with customer order form
- /pricing — Subscription plans page (UI only, no real payment)

## Product Management
- Multiple images per product (product_images table)
- Fields: name, description, price, stock, size_category (small/medium/large), slug
- Smart links: unique URL per product, storefront URL per merchant
- Social sharing: WhatsApp, Facebook buttons

## Order Flow
- Customer orders via public product page (name, phone, location pin)
- COD only — no other payment methods
- Merchant can adjust final sale price before requesting shipping
- Order → Shipment creation with prefilled data

## Shipment Lifecycle
Statuses: pending_pickup → at_warehouse → in_transit_intercity → with_distributor → delivered | returned
Status history logged in shipment_status_history table.
Admin and Vendor can update statuses.

## Financial Engine
- Wallet shows: Available Balance, Pending Balance (in-transit COD), Total
- Shipment profit table: Final Sale Price - Shipping Fee = Net Profit
- Shipment creation: deducts shipping_fee from merchant wallet
- Delivered: +COD to wallet
- Returned: -5,000 SYP fixed return fee
- Hidden platform markup: 2,000 SYP (not shown to merchant)
- Payout requests via ShamCash, Syriatel Cash, bank transfer, cash

## Error Handling
- ErrorBoundary component wraps all merchant dashboard tabs
- Prevents crashes during product addition or order updates
