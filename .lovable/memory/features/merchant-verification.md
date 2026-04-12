---
name: Merchant Verification System
description: 3-stage merchant lifecycle (created → verified → active). Merchants must confirm email, upload ID, and complete profile before operating.
type: feature
---
- Merchants have `verification_status` field: pending_verification | verified | rejected
- Required checks: email confirmed, phone, whatsapp, ID image upload, store name, contact person, city, shipping policy
- `MerchantVerificationGate` component wraps operational tabs (shipments, products, orders, wallet)
- Settings tab always accessible for completing data
- Storefront and ProductPage block unverified merchants from receiving orders
- Admin must set verification_status = 'verified' for merchant to operate
- anon RLS policy on merchants only shows verified + active merchants
