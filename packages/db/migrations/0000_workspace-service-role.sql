-- Custom SQL migration file, put your code below! --

-- Custom migration (authored via drizzle-kit generate --custom): the
-- non-owner role the operations layer runs under. RLS policies in later
-- migrations target this role; the pool's admin user SET LOCAL ROLEs into it
-- per transaction (see src/tenant.ts).
--
-- Idempotent because roles are cluster-wide: the dev and test databases share
-- one Postgres instance and both run this migration.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'workspace_service') THEN
    CREATE ROLE workspace_service NOLOGIN;
  END IF;
END
$$;

-- The migration/pool user must be able to SET ROLE into the service role.
DO $$
BEGIN
  EXECUTE format('GRANT workspace_service TO %I', current_user);
END
$$;

GRANT USAGE ON SCHEMA public TO workspace_service;

-- Table privileges for everything this user creates from now on (i.e. all
-- service tables). GRANTs are the coarse layer; per-command RLS policies are
-- the real enforcement — tables without an UPDATE/DELETE policy stay
-- append-only for this role regardless of these grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO workspace_service;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO workspace_service;
