-- Restore base Postgres GRANTS for the public schema.
-- A previous migration revoked them, which caused 403 "permission denied for table X"
-- on every authenticated request, regardless of RLS policies.
-- RLS policies remain unchanged and continue to enforce row-level access control.

GRANT USAGE ON SCHEMA public TO authenticated, anon;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public
  TO authenticated;

GRANT SELECT
  ON ALL TABLES IN SCHEMA public
  TO anon;

GRANT USAGE, SELECT
  ON ALL SEQUENCES IN SCHEMA public
  TO authenticated;

-- Make sure future tables inherit the same baseline grants automatically.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;