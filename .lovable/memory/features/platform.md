---
name: Platform Features
description: B2B logistics hub connecting merchants and shipping companies. Two roles only: Merchant and Admin.
type: feature
---
## Roles
Only TWO roles: Merchant and Admin. No driver/courier role.

## Shipment Lifecycle
Statuses: pending_pickup → at_warehouse → in_transit_intercity → with_distributor → delivered | returned
Status history logged in shipment_status_history table.
Admin manages all status updates (merged carrier functionality).

## Financial Engine
- Shipment creation: deducts shipping_fee from merchant wallet
- Delivered: +COD to wallet, -shipping_fee - 2,000 SYP hidden markup
- Returned: -5,000 SYP fixed return fee
- Hidden platform markup: 2,000 SYP (not shown to merchant)

## Pages
- /merchant — Merchant Portal (shipments, products, orders, wallet)
- /admin-logistics — Admin Portal (shipment status updates, top-up approvals, payout management, platform stats)
- /track — Public tracking page
- /topup — Merchant top-up page
