-- Fix: anonymous portal visitors can no longer resolve their business by slug,
-- so subdomain portals (e.g. refactoryacademy.partna.io) show "Portal not found".
--
-- Root cause: the lockdown migration 20260625010000 revoked SELECT on
-- public.customers from anon. But two of the SELECT policies on public.businesses
-- apply to role `public` (which includes anon) and their USING clauses run
-- subqueries against other tables:
--   * businesses_select_for_customers -> subquery on public.customers
--   * businesses_select_own           -> subquery on public.business_admins
-- PostgreSQL requires the current role to hold SELECT on every table referenced
-- by an applicable policy. Once anon lost SELECT on customers, ANY anonymous read
-- of businesses aborts with 42501 (permission denied for table customers) — even
-- though the "Public can read active businesses by slug" policy alone would have
-- returned the row. useAuth swallows the error, so the portal can't find its tenant.
--
-- These two policies are only ever satisfiable by a logged-in user (they depend on
-- auth.uid()), so scoping them to the `authenticated` role changes no real access:
-- anon never matched them anyway, and now anon no longer evaluates their subqueries.
-- Anonymous visitors continue to read active businesses via the public-slug policy.
-- The customers lockdown stays intact (no grant is restored to anon).

alter policy businesses_select_for_customers on public.businesses to authenticated;
alter policy businesses_select_own           on public.businesses to authenticated;

-- businesses_update_own (role `public`) references business_admins in the same way.
-- It does not break anything today because anon still holds SELECT on business_admins
-- and can never satisfy the auth.uid() check — but it is the same latent trap: the
-- day anon loses SELECT on business_admins, every anonymous read of businesses would
-- abort again. Scope it to authenticated now (the only role that can ever match it).
alter policy businesses_update_own           on public.businesses to authenticated;
