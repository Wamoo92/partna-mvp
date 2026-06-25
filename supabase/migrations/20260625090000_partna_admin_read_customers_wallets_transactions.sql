-- Fix: the Partna admin panel could not read customers / wallets / transactions.
--
-- "Partna admins can read all <table>" policies already exist on businesses,
-- business_wallets, business_admins and business_bank_accounts (identified by
-- admin_users.email = auth.email()), but NOT on customers, wallets or transactions.
-- So the admin panel's Customers list, Customer detail, Transactions and Dashboard
-- aggregate (AUM / savings) views come back empty. Mirror the existing pattern.
-- SELECT-only; admins are the most privileged role and are meant to see all tenants.

drop policy if exists "Partna admins can read all customers" on public.customers;
create policy "Partna admins can read all customers" on public.customers
  for select to authenticated
  using ((select admin_users.email from admin_users where admin_users.email = auth.email()) is not null);

drop policy if exists "Partna admins can read all wallets" on public.wallets;
create policy "Partna admins can read all wallets" on public.wallets
  for select to authenticated
  using ((select admin_users.email from admin_users where admin_users.email = auth.email()) is not null);

drop policy if exists "Partna admins can read all transactions" on public.transactions;
create policy "Partna admins can read all transactions" on public.transactions
  for select to authenticated
  using ((select admin_users.email from admin_users where admin_users.email = auth.email()) is not null);
