-- 1) Revoke broad execute privileges
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;

-- 2) Pin search_path on sensitive functions
ALTER FUNCTION public.create_storefront_order(uuid,uuid,integer,uuid,text,text,text,numeric,numeric,text) SET search_path = public;
ALTER FUNCTION public.get_review_context(uuid) SET search_path = public;
ALTER FUNCTION public.submit_order_review(uuid, integer, text) SET search_path = public;
ALTER FUNCTION public.track_shipment_public(text) SET search_path = public;
ALTER FUNCTION public.get_admin_analytics() SET search_path = public;
ALTER FUNCTION public.process_audit_log() SET search_path = public;
ALTER FUNCTION public.notify_order_status_change() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.prevent_merchant_status_spoof() SET search_path = public;
ALTER FUNCTION public.prevent_profile_role_change() SET search_path = public;

-- 3) Explicit grants for public RPCs
GRANT EXECUTE ON FUNCTION public.create_storefront_order(uuid,uuid,integer,uuid,text,text,text,numeric,numeric,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_review_context(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_order_review(uuid, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_shipment_public(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_order_by_sila_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_merchant_info(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_nearest_branches(double precision, double precision, double precision) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_couriers_for_order(uuid, uuid, double precision, double precision) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_courier_branches_for_order(uuid, uuid, double precision, double precision) TO anon, authenticated;

-- 4) Authenticated-only functions
GRANT EXECUTE ON FUNCTION public.get_admin_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_vendor_courier(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_payout(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_district_coords(uuid, double precision, double precision) TO authenticated;

-- 5) Ensure internal trigger functions cannot be invoked via API
REVOKE EXECUTE ON FUNCTION public.process_audit_log() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_order_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_merchant_status_spoof() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_role_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_order_price_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_shipment_weight_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_shipment_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_shipment_status_to_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_merchant_edit_after_pickup() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_merchant_edit_locked_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_user_role_self_escalation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_courier_rate_overlap() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_courier_pricing_tier() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_create_merchant_wallet() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_courier_wallet_credit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_shipment_wallet_settlement() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_order_delivered_settlement() FROM PUBLIC, anon, authenticated;