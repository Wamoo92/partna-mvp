-- ─────────────────────────────────────────────────────────────────────────
-- High 2 — card_subscription_transactions had RLS enabled but ZERO policies and
-- no SELECT grant, so it was deny-all to every client role. The admin Cards page
-- (and any dashboard/portal view) read it and got nothing.
-- Grant SELECT to authenticated and add scoped read policies:
--   • service role: full access (server functions)
--   • Partna admin: read all rows
--   • business admin: read rows for customers in their own business
--   • customer: read their own rows
-- Writes remain service-role only (no INSERT/UPDATE/DELETE granted/policied here;
-- rows are created server-side by activate-card / process-card-subscriptions).
-- ─────────────────────────────────────────────────────────────────────────
grant select on public.card_subscription_transactions to authenticated;

drop policy if exists cst_service_role_all       on public.card_subscription_transactions;
drop policy if exists cst_select_partna_admin     on public.card_subscription_transactions;
drop policy if exists cst_select_business_admin   on public.card_subscription_transactions;
drop policy if exists cst_select_own              on public.card_subscription_transactions;

create policy cst_service_role_all on public.card_subscription_transactions
  for all to public
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy cst_select_partna_admin on public.card_subscription_transactions
  for select to authenticated
  using (exists (select 1 from public.admin_users au where au.email = auth.email()));

create policy cst_select_business_admin on public.card_subscription_transactions
  for select to authenticated
  using (
    exists (
      select 1
      from public.customers c
      join public.business_admins ba on ba.business_id = c.business_id
      where c.id = card_subscription_transactions.customer_id
        and ba.auth_user_id = auth.uid()
    )
  );

create policy cst_select_own on public.card_subscription_transactions
  for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = card_subscription_transactions.customer_id
        and c.auth_user_id = auth.uid()
    )
  );
