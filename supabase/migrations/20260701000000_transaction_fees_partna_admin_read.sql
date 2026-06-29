-- ─────────────────────────────────────────────────────────────────────────
-- Issue 1 — Partna admin revenue page shows no transaction fees / UGX 0 revenue.
-- The transaction_fees rows ARE created correctly by process-withdrawal etc., but
-- the table only had a customer-owns SELECT policy and a service-role policy — no
-- policy for Partna admins. So the admin Revenue page and Dashboard (which read
-- transaction_fees as the authenticated admin) saw nothing.
-- Let Partna admins (rows in admin_users matched by email) read all fee rows.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists transaction_fees_select_partna_admin on public.transaction_fees;
create policy transaction_fees_select_partna_admin on public.transaction_fees
  for select to authenticated
  using (
    exists (
      select 1 from public.admin_users au
      where au.email = auth.email()
    )
  );
