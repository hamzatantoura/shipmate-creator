
-- ============ 1. FIX TRACKING PII LEAK ============
-- Remove the overly permissive anon SELECT on shipments
DROP POLICY IF EXISTS "Public can track shipments by tracking number" ON public.shipments;

-- Create a secure function that returns ONLY safe tracking info
CREATE OR REPLACE FUNCTION public.track_shipment_public(p_tracking_number text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'tracking_number', s.tracking_number,
    'status', s.status,
    'city', s.city,
    'created_at', s.created_at,
    'updated_at', s.updated_at,
    'carrier_name', COALESCE(c.name_ar, ''),
    'history', COALESCE((
      SELECT json_agg(json_build_object(
        'new_status', al.new_status,
        'old_status', al.old_status,
        'created_at', al.created_at
      ) ORDER BY al.created_at ASC)
      FROM public.audit_logs al
      WHERE al.shipment_id = s.id
    ), '[]'::json)
  ) INTO result
  FROM public.shipments s
  LEFT JOIN public.carriers c ON c.id = s.carrier_id
  WHERE s.tracking_number = p_tracking_number
  LIMIT 1;
  
  RETURN result;
END;
$$;

-- Grant anon access to call this function
GRANT EXECUTE ON FUNCTION public.track_shipment_public(text) TO anon;
GRANT EXECUTE ON FUNCTION public.track_shipment_public(text) TO authenticated;

-- ============ 2. FIX MERCHANT DATA LEAK ============
-- Replace the current anon policy that exposes all merchant columns
DROP POLICY IF EXISTS "Public can view verified active merchant info" ON public.merchants;

-- Create a secure function for storefront merchant info (no phone, no balance, no docs)
CREATE OR REPLACE FUNCTION public.get_public_merchant_info(p_merchant_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'store_name', m.store_name,
    'city', m.city,
    'is_active', m.is_active,
    'verification_status', m.verification_status
  ) INTO result
  FROM public.merchants m
  WHERE m.user_id = p_merchant_user_id
    AND m.is_active = true
    AND m.verification_status = 'verified'
  LIMIT 1;
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_merchant_info(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_merchant_info(uuid) TO authenticated;

-- ============ 3. FIX ANONYMOUS UPLOADS ============
-- Remove any permissive policies on storage.objects for uploads bucket
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload" ON storage.objects;
DROP POLICY IF EXISTS "Public upload" ON storage.objects;
DROP POLICY IF EXISTS "allow_public_uploads" ON storage.objects;

-- Create secure upload policies - only authenticated users
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('uploads', 'product-images'));

CREATE POLICY "Authenticated users can update own files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('uploads', 'product-images') AND (auth.uid()::text = (storage.foldername(name))[1]));

CREATE POLICY "Anyone can view public bucket files"
ON storage.objects FOR SELECT TO public
USING (bucket_id IN ('uploads', 'product-images'));

CREATE POLICY "Authenticated users can delete own files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('uploads', 'product-images') AND (auth.uid()::text = (storage.foldername(name))[1]));

-- ============ 4. PREVENT INSERT FORGERY ============
-- Remove open INSERT policies - these tables should only be written by triggers/functions
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "System can insert status history" ON public.shipment_status_history;
DROP POLICY IF EXISTS "System can insert wallet transactions" ON public.wallet_transactions;

-- No new INSERT policies needed - the SECURITY DEFINER functions/triggers handle inserts:
-- audit_logs: inserted by log_shipment_status_change() trigger
-- shipment_status_history: can be inserted via offline-sync, so we need a restricted policy
-- wallet_transactions: inserted by handle_shipment_wallet_settlement() trigger

-- For shipment_status_history, allow vendors/admins only (for offline sync)
CREATE POLICY "Vendors and admins can insert status history"
ON public.shipment_status_history FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'vendor'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);
