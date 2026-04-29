
-- ============================================================
-- STEP 5: Database Integrity (Foreign Keys & Constraints)
-- ============================================================
-- Assumption about existing data:
-- A pre-flight scan found:
--   * 7 orders, 8 shipments, 3 wallets reference merchant user_ids
--     that no longer exist in the merchants table (dead test data,
--     unreachable via RLS).
--   * 0 duplicate or NULL user_id values in merchants.
-- We delete the orphaned rows so the FKs can be installed cleanly.
-- All other relationships are already clean.
-- ============================================================

BEGIN;

-- ---------- 1. Clean up orphaned data ----------------------
DELETE FROM public.wallets w
WHERE NOT EXISTS (SELECT 1 FROM public.merchants m WHERE m.user_id = w.merchant_id);

DELETE FROM public.shipments s
WHERE NOT EXISTS (SELECT 1 FROM public.merchants m WHERE m.user_id = s.merchant_id);

DELETE FROM public.orders o
WHERE NOT EXISTS (SELECT 1 FROM public.merchants m WHERE m.user_id = o.merchant_id);

-- ---------- 2. merchants.user_id NOT NULL + UNIQUE ---------
ALTER TABLE public.merchants
  ALTER COLUMN user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'merchants_user_id_key' AND conrelid = 'public.merchants'::regclass
  ) THEN
    ALTER TABLE public.merchants
      ADD CONSTRAINT merchants_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- ---------- 3. Helper: drop existing FK if present ---------
CREATE OR REPLACE FUNCTION public._drop_fk_if_exists(p_table text, p_constraint text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = p_constraint
      AND conrelid = p_table::regclass
  ) THEN
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', p_table, p_constraint);
  END IF;
END $$;

-- ---------- 4. merchants.user_id -> profiles.user_id -------
SELECT public._drop_fk_if_exists('public.merchants', 'merchants_user_id_fkey');
ALTER TABLE public.merchants
  ADD CONSTRAINT merchants_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id)
  ON DELETE CASCADE;

-- ---------- 5. couriers vendor/user links ------------------
SELECT public._drop_fk_if_exists('public.couriers', 'couriers_vendor_id_fkey');
ALTER TABLE public.couriers
  ADD CONSTRAINT couriers_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES public.profiles(user_id)
  ON DELETE SET NULL;

SELECT public._drop_fk_if_exists('public.couriers', 'couriers_user_id_fkey');
ALTER TABLE public.couriers
  ADD CONSTRAINT couriers_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id)
  ON DELETE SET NULL;

-- ---------- 6. orders relationships ------------------------
SELECT public._drop_fk_if_exists('public.orders', 'orders_merchant_id_fkey');
ALTER TABLE public.orders
  ADD CONSTRAINT orders_merchant_id_fkey
  FOREIGN KEY (merchant_id) REFERENCES public.merchants(user_id)
  ON DELETE RESTRICT;

SELECT public._drop_fk_if_exists('public.orders', 'orders_courier_id_fkey');
ALTER TABLE public.orders
  ADD CONSTRAINT orders_courier_id_fkey
  FOREIGN KEY (courier_id) REFERENCES public.couriers(id)
  ON DELETE SET NULL;

SELECT public._drop_fk_if_exists('public.orders', 'orders_product_id_fkey');
ALTER TABLE public.orders
  ADD CONSTRAINT orders_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id)
  ON DELETE SET NULL;

SELECT public._drop_fk_if_exists('public.orders', 'orders_district_id_fkey');
ALTER TABLE public.orders
  ADD CONSTRAINT orders_district_id_fkey
  FOREIGN KEY (district_id) REFERENCES public.districts(id)
  ON DELETE SET NULL;

SELECT public._drop_fk_if_exists('public.orders', 'orders_shipment_id_fkey');
ALTER TABLE public.orders
  ADD CONSTRAINT orders_shipment_id_fkey
  FOREIGN KEY (shipment_id) REFERENCES public.shipments(id)
  ON DELETE SET NULL;

-- ---------- 7. shipments relationships ---------------------
SELECT public._drop_fk_if_exists('public.shipments', 'shipments_merchant_id_fkey');
ALTER TABLE public.shipments
  ADD CONSTRAINT shipments_merchant_id_fkey
  FOREIGN KEY (merchant_id) REFERENCES public.merchants(user_id)
  ON DELETE RESTRICT;

SELECT public._drop_fk_if_exists('public.shipments', 'shipments_courier_id_fkey');
ALTER TABLE public.shipments
  ADD CONSTRAINT shipments_courier_id_fkey
  FOREIGN KEY (courier_id) REFERENCES public.couriers(id)
  ON DELETE SET NULL;

SELECT public._drop_fk_if_exists('public.shipments', 'shipments_order_id_fkey');
ALTER TABLE public.shipments
  ADD CONSTRAINT shipments_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id)
  ON DELETE CASCADE;

-- ---------- 8. wallets.merchant_id -------------------------
SELECT public._drop_fk_if_exists('public.wallets', 'wallets_merchant_id_fkey');
ALTER TABLE public.wallets
  ADD CONSTRAINT wallets_merchant_id_fkey
  FOREIGN KEY (merchant_id) REFERENCES public.merchants(user_id)
  ON DELETE CASCADE;
-- Note: wallets table has no courier_id column (couriers carry their
-- own wallet_balance directly), so no courier FK is added here.

-- ---------- 9. Supporting indexes for FK lookups -----------
CREATE INDEX IF NOT EXISTS idx_orders_merchant_id ON public.orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_courier_id ON public.orders(courier_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON public.orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_district_id ON public.orders(district_id);
CREATE INDEX IF NOT EXISTS idx_orders_shipment_id ON public.orders(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipments_merchant_id ON public.shipments(merchant_id);
CREATE INDEX IF NOT EXISTS idx_shipments_courier_id ON public.shipments(courier_id);
CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON public.shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_wallets_merchant_id ON public.wallets(merchant_id);
CREATE INDEX IF NOT EXISTS idx_couriers_vendor_id ON public.couriers(vendor_id);
CREATE INDEX IF NOT EXISTS idx_couriers_user_id ON public.couriers(user_id);

-- ---------- 10. Drop the helper function -------------------
DROP FUNCTION IF EXISTS public._drop_fk_if_exists(text, text);

COMMIT;
