-- Restore standard privileges for the service_role across the public schema.
--
-- Symptom this fixes: Edge Functions that use the SUPABASE_SERVICE_ROLE_KEY
-- (e.g. complete-customer-registration) were getting Postgres error 42501
-- "permission denied for table customers" on simple SELECT/UPDATE calls, which
-- the function surfaced to users as "Customer record not found".
--
-- Root cause: the DML privileges (SELECT/INSERT/UPDATE/DELETE) had been revoked
-- from service_role on almost every table in the public schema. Only a handful
-- of recently-created tables still had them. service_role is the trusted backend
-- key (it bypasses RLS) and is expected to have full access by Supabase default,
-- so this restores that default rather than granting anything new in spirit.

GRANT USAGE ON SCHEMA public TO service_role;

GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES  IN SCHEMA public TO service_role;

-- Ensure tables/sequences/routines created in the future also grant to service_role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES  TO service_role;
