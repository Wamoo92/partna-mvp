-- Fix: the business dashboard could not read its own customers' data.
--
-- The Block 1 lockdown revoked anon access to customers, and customers only ever
-- had a "Customers read own profile" RLS policy (auth.uid() = auth_user_id). So an
-- authenticated business admin can't read any customer rows — which means the
-- dashboard Customers list, Overview "total savings", and campaign "saved" stats
-- (all of which read customers / wallets / transactions) come back empty.
--
-- Add tenant-scoped, SELECT-only policies letting a business admin read the
-- customers / wallets / transactions belonging to THEIR OWN business (via
-- business_admins membership). This mirrors the existing business-scoped read
-- policies on students, campaigns and the business_* tables. No write access is
-- granted; money mutation stays service-role only.

-- ── customers ─────────────────────────────────────────────────────────────
drop policy if exists customers_select_business_admin on public.customers;
create policy customers_select_business_admin on public.customers
  for select to authenticated
  using (exists (
    select 1 from public.business_admins ba
    where ba.business_id = customers.business_id
      and ba.auth_user_id = auth.uid()
  ));

-- ── wallets ───────────────────────────────────────────────────────────────
drop policy if exists wallets_select_business_admin on public.wallets;
create policy wallets_select_business_admin on public.wallets
  for select to authenticated
  using (exists (
    select 1 from public.customers c
    join public.business_admins ba on ba.business_id = c.business_id
    where c.id = wallets.customer_id
      and ba.auth_user_id = auth.uid()
  ));

-- ── transactions ──────────────────────────────────────────────────────────
drop policy if exists transactions_select_business_admin on public.transactions;
create policy transactions_select_business_admin on public.transactions
  for select to authenticated
  using (exists (
    select 1 from public.customers c
    join public.business_admins ba on ba.business_id = c.business_id
    where c.id = transactions.customer_id
      and ba.auth_user_id = auth.uid()
  ));
