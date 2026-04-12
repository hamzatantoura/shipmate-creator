
-- Drop existing policies on storage.objects for uploads bucket if any
DO $$
BEGIN
  -- Try dropping common policy names
  DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
  DROP POLICY IF EXISTS "Users can upload to uploads bucket" ON storage.objects;
  DROP POLICY IF EXISTS "Anyone can view uploads" ON storage.objects;
  DROP POLICY IF EXISTS "Public read access for uploads" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload to uploads" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update their uploads" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their uploads" ON storage.objects;
END $$;

-- Allow authenticated users to upload to uploads bucket
CREATE POLICY "auth_upload_to_uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'uploads');

-- Allow authenticated users to update their own uploads
CREATE POLICY "auth_update_uploads"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'uploads');

-- Allow public read access (bucket is already public)
CREATE POLICY "public_read_uploads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'uploads');
