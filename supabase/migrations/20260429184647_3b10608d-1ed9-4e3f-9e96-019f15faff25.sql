-- =====================================================
-- STEP 4: Storage bucket security hardening
-- =====================================================

-- 1) Flip `uploads` to private (signed URLs from now on)
UPDATE storage.buckets SET public = false WHERE id = 'uploads';

-- =====================================================
-- 2) DROP all leaky / overly-permissive policies we are replacing
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view public bucket files"            ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files"           ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update own files"       ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own files"       ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload product images"  ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own product images"            ON storage.objects;
DROP POLICY IF EXISTS "auth_upload_to_uploads"                         ON storage.objects;
DROP POLICY IF EXISTS "auth_update_uploads"                            ON storage.objects;
DROP POLICY IF EXISTS "public_read_uploads"                            ON storage.objects;
-- Existing per-bucket policies we're rewriting cleanly
DROP POLICY IF EXISTS "Public can view product images"                 ON storage.objects;
DROP POLICY IF EXISTS "Public read merchant logos"                     ON storage.objects;
DROP POLICY IF EXISTS "Public read courier logos"                      ON storage.objects;
DROP POLICY IF EXISTS "Merchants upload own logo"                      ON storage.objects;
DROP POLICY IF EXISTS "Merchants update own logo"                      ON storage.objects;
DROP POLICY IF EXISTS "Merchants delete own logo"                      ON storage.objects;
DROP POLICY IF EXISTS "Merchants upload own KYC"                       ON storage.objects;
DROP POLICY IF EXISTS "Merchants read own KYC"                         ON storage.objects;
DROP POLICY IF EXISTS "Merchants update own KYC"                       ON storage.objects;
DROP POLICY IF EXISTS "Merchants delete own KYC"                       ON storage.objects;
DROP POLICY IF EXISTS "Admins upload courier logos"                    ON storage.objects;
DROP POLICY IF EXISTS "Admins update courier logos"                    ON storage.objects;
DROP POLICY IF EXISTS "Admins delete courier logos"                    ON storage.objects;

-- =====================================================
-- 3) PRIVATE bucket: uploads (financial receipts)
--    Path layout enforced going forward:
--      merchants/<auth.uid()>/...   -> owned by that merchant
--      anything else (e.g. payouts/..., couriers/...) -> admin only
-- =====================================================

-- Merchant: read own folder
CREATE POLICY "uploads_merchant_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = 'merchants'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Merchant: insert into own folder
CREATE POLICY "uploads_merchant_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = 'merchants'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Merchant: update own folder
CREATE POLICY "uploads_merchant_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = 'merchants'
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = 'merchants'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Merchant: delete own folder
CREATE POLICY "uploads_merchant_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = 'merchants'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Admin: full control over uploads bucket
CREATE POLICY "uploads_admin_all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'uploads' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'uploads' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- =====================================================
-- 4) PRIVATE bucket: merchant-kyc (ID docs, verification video)
-- =====================================================

-- Owner: read/insert/update/delete inside own folder (path: <uid>/...)
CREATE POLICY "kyc_owner_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'merchant-kyc'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "kyc_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'merchant-kyc'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "kyc_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'merchant-kyc'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'merchant-kyc'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "kyc_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'merchant-kyc'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins: full access (review of KYC documents)
CREATE POLICY "kyc_admin_all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'merchant-kyc' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'merchant-kyc' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- =====================================================
-- 5) PUBLIC buckets: product-images, merchant-logos, courier-logos
--    - Public READ (so logos/photos render anywhere)
--    - Owner WRITE inside their own user-id folder (path: <uid>/...)
--    - Admins: full control
-- =====================================================

-- Public read (anon + authenticated)
CREATE POLICY "public_assets_read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id IN ('product-images', 'merchant-logos', 'courier-logos'));

-- Owner upload to own folder
CREATE POLICY "public_assets_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('product-images', 'merchant-logos', 'courier-logos')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner update own files
CREATE POLICY "public_assets_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('product-images', 'merchant-logos', 'courier-logos')
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id IN ('product-images', 'merchant-logos', 'courier-logos')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner delete own files
CREATE POLICY "public_assets_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('product-images', 'merchant-logos', 'courier-logos')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins: full control on the public asset buckets (needed for courier-logos uploads
-- managed in admin UI: path will be <courier_id>/...)
CREATE POLICY "public_assets_admin_all"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id IN ('product-images', 'merchant-logos', 'courier-logos')
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    bucket_id IN ('product-images', 'merchant-logos', 'courier-logos')
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );
