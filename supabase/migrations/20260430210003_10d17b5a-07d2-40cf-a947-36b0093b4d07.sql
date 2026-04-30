-- Architectural fix: orders and shipments must be decoupled.
-- An order represents the merchant's intent; a shipment represents physical
-- handover to the courier. They must NOT be created together.
--
-- 1) Drop the AFTER INSERT trigger that auto-creates a shipment for every new order.
-- 2) Keep the UPDATE sync trigger so that once a shipment exists, COD/fee changes
--    on the order propagate to the shipment.

drop trigger if exists orders_create_shipment_aft_ins on public.orders;
drop function if exists public.create_shipment_for_order();