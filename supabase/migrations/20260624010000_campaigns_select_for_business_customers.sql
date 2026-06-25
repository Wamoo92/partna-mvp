-- Let a signed-in customer see the active campaigns of their own business.
--
-- Symptom this fixes: on the Select Campaign page (portal), a newly-registered
-- customer saw "No campaigns available yet" even though their business has an
-- active campaign. SelectCampaign.jsx runs:
--   from('campaigns').select('*').eq('business_id', …).eq('status','active')
-- as the authenticated customer.
--
-- Root cause: RLS is enabled on public.campaigns and the only customer-facing
-- SELECT policy (campaigns_select_for_enrolled_customers) requires an existing
-- row in customer_campaigns — i.e. the customer must already be enrolled. That
-- is a chicken-and-egg problem: a customer must see a campaign to enrol, but
-- could only see it after enrolling. The other SELECT policy is admin-only.
--
-- Fix: a permissive SELECT policy granting read access to active campaigns whose
-- business matches the business on the caller's own customer record. RLS
-- policies are OR-combined, so this only widens read access and restricts
-- nothing. Mirrors the existing enrolled-customers policy's EXISTS pattern.

create policy "campaigns_select_active_for_business_customers"
on public.campaigns
for select
to authenticated
using (
  status = 'active'
  and exists (
    select 1
    from public.customers c
    where c.auth_user_id = auth.uid()
      and c.business_id = campaigns.business_id
  )
);
