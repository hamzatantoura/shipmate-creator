-- Step 7: Performance indexes for highly queried/filtered non-FK columns

-- Orders: filtered constantly by status, sorted by created_at
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);

-- Shipments: tracking_number is the public lookup key
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_number ON public.shipments (tracking_number);

-- Wallet transactions: ledger queries always filter by wallet + sort by date
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON public.wallet_transactions (wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON public.wallet_transactions (created_at DESC);