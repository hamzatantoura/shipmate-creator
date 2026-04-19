-- Ensure name is filled for every row
UPDATE public.districts
SET name = COALESCE(NULLIF(name,''), NULLIF(area_ar,''), province_ar)
WHERE name IS NULL OR name = '';

-- Make name NOT NULL going forward
ALTER TABLE public.districts ALTER COLUMN name SET NOT NULL;

-- Admin policies for districts CRUD
CREATE POLICY "Admins can insert districts"
  ON public.districts FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update districts"
  ON public.districts FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete districts"
  ON public.districts FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));