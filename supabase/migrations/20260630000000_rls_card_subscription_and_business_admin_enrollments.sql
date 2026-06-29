-- ─────────────────────────────────────────────────────────────────────────
-- Bug 2 — Card activation deducts funds but the card still shows "Activate".
-- activate-card (service role) correctly debits the wallet and inserts a
-- card_subscriptions row with status='active'. But CardDetail reads
-- card_subscriptions client-side as the authenticated customer to decide whether
-- the card is active — and that table had NO select grant and NO RLS policy for
-- authenticated, so the read always returned nothing and the card looked
-- un-activated even though the fee had been charged.
-- Let customers read their OWN card subscription. Writes stay server-side only.
-- ─────────────────────────────────────────────────────────────────────────
grant select on public.card_subscriptions to authenticated;

drop policy if exists card_subscriptions_select_own on public.card_subscriptions;
create policy card_subscriptions_select_own on public.card_subscriptions
  for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = card_subscriptions.customer_id
        and c.auth_user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- Bug 3 — Students page shows "No enrolled parent" for every student.
-- The dashboard Students page joins students -> customer_campaigns -> customers
-- as the authenticated business admin. customer_campaigns only had a
-- customer-owns SELECT policy and a service-role policy, so a business admin
-- could not read any enrollment rows and the embed came back empty.
-- Let business admins read enrollments that belong to their own business.
-- (customer_campaigns.business_id is already populated by enroll-campaign.)
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists customer_campaigns_select_business_admin on public.customer_campaigns;
create policy customer_campaigns_select_business_admin on public.customer_campaigns
  for select to authenticated
  using (
    exists (
      select 1 from public.business_admins ba
      where ba.business_id = customer_campaigns.business_id
        and ba.auth_user_id = auth.uid()
    )
  );
