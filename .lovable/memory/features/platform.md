---
name: Platform Features
description: Multi-store SaaS with full shipment lifecycle, carrier portal, payout system, public tracking, hidden markup
type: feature
---
## Shipment Lifecycle
Statuses: pending_pickup → at_warehouse → in_transit_intercity → with_distributor → delivered | returned
Status history logged in shipment_status_history table.

## Financial Engine
- Shipment creation: deducts shipping_fee from merchant wallet
- Delivered: +COD to wallet, -shipping_fee - 2,000 SYP hidden markup
- Returned: -5,000 SYP fixed return fee
- Hidden platform markup: 2,000 SYP (not shown to merchant)

## Payout Requests
- Merchant submits via wallet page (amount ≤ balance, method, account_details)
- Admin manages at /admin/payouts (pending → processing → completed)
- Receipt upload by admin, viewable by merchant

## Pages
- /carrier — Carrier Portal (status updates, history, financial triggers)
- /track — Public tracking page (tracking number search, timeline)
- /admin/payouts — Admin payout management
- /wallet — Merchant wallet with payout request dialog
- /driver — Driver delivery dashboard
