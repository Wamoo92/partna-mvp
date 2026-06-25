-- Critical fix: let an authenticated customer read/write the rows that belong to
-- them, so the core portal flows (enrol in a campaign, create a wallet, deposit,
-- withdraw, pay fees, save a payment source, leave/close account) actually work.
--
-- Audit finding: almost every table the portal writes had service_role-only RLS
-- policies and, in several cases, no authenticated INSERT/UPDATE grant either.
-- The result was that enrolment, wallet creation, and all money movement were
-- silently blocked by RLS / permission-denied. This migration adds the missing
-- table grants and "own-row" RLS policies for the authenticated role.
--
-- Ownership rule: a row belongs to the caller when its customer_id maps to a
-- customers row whose auth_user_id = auth.uid(). escrow_wallets has no
-- customer_id, so it is scoped to the caller's own business_id instead.
--
-- NOTE (carried to the next phase, NOT fixed here): these policies scope writes
-- to the caller's own rows, but the app still mutates balances/escrow/sales
-- directly from the client. A customer can therefore still write arbitrary
-- amounts to their OWN wallet/transactions/escrow. That is an architectural risk
-- inherent to client-side money mutation and should be moved server-side
-- (Edge Functions with service_role) in the money-flow hardening phase.

-- ─────────────────────────── GRANTS ───────────────────────────
-- wallets, transactions, transaction_fees already have full DML grants for
-- authenticated; they were only missing policies (added below).
grant select, insert, update, delete on public.customer_campaigns to authenticated;
grant select, insert, update          on public.customer_discounts to authenticated;
grant select, insert, update          on public.escrow_wallets      to authenticated;
grant select, insert                  on public.sales               to authenticated;
grant update                          on public.customers           to authenticated;

-- ──────────────────────── customer_campaigns ────────────────────────
drop policy if exists customer_campaigns_select_own on public.customer_campaigns;
create policy customer_campaigns_select_own on public.customer_campaigns
  for select to authenticated
  using (exists (select 1 from public.customers c
                 where c.id = customer_campaigns.customer_id and c.auth_user_id = auth.uid()));

drop policy if exists customer_campaigns_insert_own on public.customer_campaigns;
create policy customer_campaigns_insert_own on public.customer_campaigns
  for insert to authenticated
  with check (exists (select 1 from public.customers c
                      where c.id = customer_campaigns.customer_id and c.auth_user_id = auth.uid()));

drop policy if exists customer_campaigns_update_own on public.customer_campaigns;
create policy customer_campaigns_update_own on public.customer_campaigns
  for update to authenticated
  using       (exists (select 1 from public.customers c
                       where c.id = customer_campaigns.customer_id and c.auth_user_id = auth.uid()))
  with check  (exists (select 1 from public.customers c
                       where c.id = customer_campaigns.customer_id and c.auth_user_id = auth.uid()));

-- ──────────────────────────── wallets ────────────────────────────
-- (SELECT policy wallets_select_own already exists.)
drop policy if exists wallets_insert_own on public.wallets;
create policy wallets_insert_own on public.wallets
  for insert to authenticated
  with check (exists (select 1 from public.customers c
                      where c.id = wallets.customer_id and c.auth_user_id = auth.uid()));

drop policy if exists wallets_update_own on public.wallets;
create policy wallets_update_own on public.wallets
  for update to authenticated
  using       (exists (select 1 from public.customers c
                       where c.id = wallets.customer_id and c.auth_user_id = auth.uid()))
  with check  (exists (select 1 from public.customers c
                       where c.id = wallets.customer_id and c.auth_user_id = auth.uid()));

-- ────────────────────────── transactions ──────────────────────────
-- (SELECT policies already exist; the portal only inserts.)
drop policy if exists transactions_insert_own on public.transactions;
create policy transactions_insert_own on public.transactions
  for insert to authenticated
  with check (exists (select 1 from public.customers c
                      where c.id = transactions.customer_id and c.auth_user_id = auth.uid()));

-- ───────────────────────── transaction_fees ─────────────────────────
drop policy if exists transaction_fees_insert_own on public.transaction_fees;
create policy transaction_fees_insert_own on public.transaction_fees
  for insert to authenticated
  with check (exists (select 1 from public.customers c
                      where c.id = transaction_fees.customer_id and c.auth_user_id = auth.uid()));

-- ───────────────────────────── sales ─────────────────────────────
drop policy if exists sales_insert_own on public.sales;
create policy sales_insert_own on public.sales
  for insert to authenticated
  with check (exists (select 1 from public.customers c
                      where c.id = sales.customer_id and c.auth_user_id = auth.uid()));

-- ──────────────────────── escrow_wallets ────────────────────────
-- Business-scoped (no customer_id column).
drop policy if exists escrow_wallets_select_own_business on public.escrow_wallets;
create policy escrow_wallets_select_own_business on public.escrow_wallets
  for select to authenticated
  using (exists (select 1 from public.customers c
                 where c.business_id = escrow_wallets.business_id and c.auth_user_id = auth.uid()));

drop policy if exists escrow_wallets_insert_own_business on public.escrow_wallets;
create policy escrow_wallets_insert_own_business on public.escrow_wallets
  for insert to authenticated
  with check (exists (select 1 from public.customers c
                      where c.business_id = escrow_wallets.business_id and c.auth_user_id = auth.uid()));

drop policy if exists escrow_wallets_update_own_business on public.escrow_wallets;
create policy escrow_wallets_update_own_business on public.escrow_wallets
  for update to authenticated
  using       (exists (select 1 from public.customers c
                       where c.business_id = escrow_wallets.business_id and c.auth_user_id = auth.uid()))
  with check  (exists (select 1 from public.customers c
                       where c.business_id = escrow_wallets.business_id and c.auth_user_id = auth.uid()));

-- ─────────────────────── customer_discounts ───────────────────────
drop policy if exists customer_discounts_select_own on public.customer_discounts;
create policy customer_discounts_select_own on public.customer_discounts
  for select to authenticated
  using (exists (select 1 from public.customers c
                 where c.id = customer_discounts.customer_id and c.auth_user_id = auth.uid()));

drop policy if exists customer_discounts_update_own on public.customer_discounts;
create policy customer_discounts_update_own on public.customer_discounts
  for update to authenticated
  using       (exists (select 1 from public.customers c
                       where c.id = customer_discounts.customer_id and c.auth_user_id = auth.uid()))
  with check  (exists (select 1 from public.customers c
                       where c.id = customer_discounts.customer_id and c.auth_user_id = auth.uid()));

-- ─────────────────────────── customers ───────────────────────────
-- Lets a signed-in customer update their own profile row (payment source,
-- account-deletion status). Scoped strictly to their own row.
drop policy if exists customers_update_own on public.customers;
create policy customers_update_own on public.customers
  for update to authenticated
  using       (auth.uid() = auth_user_id)
  with check  (auth.uid() = auth_user_id);
