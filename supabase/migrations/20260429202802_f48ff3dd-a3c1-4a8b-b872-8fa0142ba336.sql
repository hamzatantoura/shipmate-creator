-- ============================================================================
-- STEP 14: System-Wide Audit Log
-- Note: A legacy `audit_logs` table already exists for shipment status history
-- with an incompatible schema. To avoid breaking that, we introduce a new
-- generic table `system_audit_logs` that captures JSONB deltas across the
-- platform.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.system_audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid,                       -- auth.uid() of who made the change (nullable for system actions)
  table_name  text NOT NULL,
  record_id   uuid,
  action      text NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sys_audit_created_at ON public.system_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sys_audit_table_record ON public.system_audit_logs (table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_sys_audit_actor ON public.system_audit_logs (actor_id);

ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read; nobody can write directly (writes go through trigger which is SECURITY DEFINER)
DROP POLICY IF EXISTS "Admins view system audit logs" ON public.system_audit_logs;
CREATE POLICY "Admins view system audit logs"
  ON public.system_audit_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- Generic audit trigger function
-- Captures auth.uid() and stores JSON delta of the row.
-- Defensive: uses EXCEPTION block so failures never block primary writes.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid;
  _record_id uuid;
  _old jsonb;
  _new jsonb;
BEGIN
  BEGIN
    _actor := auth.uid();

    IF TG_OP = 'INSERT' THEN
      _new := to_jsonb(NEW);
      _record_id := (NEW).id;
      INSERT INTO public.system_audit_logs (actor_id, table_name, record_id, action, old_data, new_data)
      VALUES (_actor, TG_TABLE_NAME, _record_id, 'INSERT', NULL, _new);
      RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
      _old := to_jsonb(OLD);
      _new := to_jsonb(NEW);
      -- Skip if nothing actually changed
      IF _old IS DISTINCT FROM _new THEN
        _record_id := (NEW).id;
        INSERT INTO public.system_audit_logs (actor_id, table_name, record_id, action, old_data, new_data)
        VALUES (_actor, TG_TABLE_NAME, _record_id, 'UPDATE', _old, _new);
      END IF;
      RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
      _old := to_jsonb(OLD);
      _record_id := (OLD).id;
      INSERT INTO public.system_audit_logs (actor_id, table_name, record_id, action, old_data, new_data)
      VALUES (_actor, TG_TABLE_NAME, _record_id, 'DELETE', _old, NULL);
      RETURN OLD;
    END IF;

    RETURN NULL;
  EXCEPTION WHEN OTHERS THEN
    -- Never block the primary write because of audit logging
    RAISE WARNING 'process_audit_log failed for table % op %: %', TG_TABLE_NAME, TG_OP, SQLERRM;
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END;
END;
$$;

-- ============================================================================
-- Attach triggers to sensitive tables
-- ============================================================================

-- ORDERS
DROP TRIGGER IF EXISTS trg_audit_orders ON public.orders;
CREATE TRIGGER trg_audit_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- WALLETS
DROP TRIGGER IF EXISTS trg_audit_wallets ON public.wallets;
CREATE TRIGGER trg_audit_wallets
  AFTER INSERT OR UPDATE OR DELETE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- MERCHANTS
DROP TRIGGER IF EXISTS trg_audit_merchants ON public.merchants;
CREATE TRIGGER trg_audit_merchants
  AFTER INSERT OR UPDATE OR DELETE ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- COURIERS
DROP TRIGGER IF EXISTS trg_audit_couriers ON public.couriers;
CREATE TRIGGER trg_audit_couriers
  AFTER INSERT OR UPDATE OR DELETE ON public.couriers
  FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();
