UPDATE public.merchants m
SET province_id = p.id
FROM public.provinces p
WHERE p.name_ar = m.city
  AND m.province_id IS NULL
  AND m.city IS NOT NULL;