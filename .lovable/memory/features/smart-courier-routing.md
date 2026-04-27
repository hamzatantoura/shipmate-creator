---
name: smart-courier-routing
description: Geographic branch-based courier routing — branches as pickup points with lat/lng proximity matching
type: feature
---
# نظام التوجيه الذكي للفروع (Sila)

## النموذج
الفروع = نقاط استلام جغرافية للعميل (lat/lng إلزامية، district_id اختياري).
المناطق/الأحياء = إحداثيات مرجعية فقط لحساب القرب من الفروع.

## القاعدة
شركة الشحن تظهر للتاجر فقط إذا كان لديها فرع نشط في:
- محافظة التاجر (`merchants.province_id`) — نقطة الإرسال
- محافظة العميل (المختارة في الطلب) — نقطة الاستلام

ثم تُرتَّب الشركات حسب أقرب فرع جغرافياً لإحداثيات حي العميل (Haversine).

## المكونات التقنية
- RPC: `find_couriers_for_order(merchant_province_id, customer_province_id, customer_lat, customer_lng)` — يُرجع الشركات + الفرع الأقرب لكل شركة + المسافة + عدد الفروع.
- RPC: `set_district_coords(district_id, lat, lng)` — للأدمن لضبط إحداثيات الأحياء.
- العمود: `orders.assigned_branch_id` — يحفظ الفرع المعيّن للاستلام.
- التسعير: من `courier_pricing_tiers` (شرائح وزنية لكل شركة) — لا يعتمد على district.

## ملاحظة
أحياء حلب لها إحداثيات (24 منطقة). باقي المحافظات تحتاج إثراء بنفس الطريقة.
