-- Allow merchants to read field_audit_logs that belong to their own orders or shipments.
-- Admins already have a SELECT policy. This adds a second permissive SELECT policy for merchants
-- restricted to records owned by them.

CREATE POLICY "Merchants view audits for own records"
ON public.field_audit_logs
FOR SELECT
TO authenticated
USING (
  (
    table_name = 'orders' AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = field_audit_logs.record_id
        AND o.merchant_id = auth.uid()
    )
  )
  OR
  (
    table_name = 'shipments' AND EXISTS (
      SELECT 1 FROM public.shipments s
      WHERE s.id = field_audit_logs.record_id
        AND s.merchant_id = auth.uid()
    )
  )
);
