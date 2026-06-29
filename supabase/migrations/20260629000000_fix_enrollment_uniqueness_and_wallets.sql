-- ─────────────────────────────────────────────────────────────────────────
-- Bug 1 — wrong uniqueness rule on customer_campaigns.
-- The old constraint UNIQUE (customer_id, campaign_id) blocked:
--   • enrolling the same campaign for a DIFFERENT student (education), and
--   • re-enrolling a campaign the customer previously LEFT (the left row keeps
--     the (customer, campaign) pair, so the next insert collides).
-- The correct rule is: one ACTIVE enrollment per (customer, campaign, student),
-- and (separately) one active education campaign per student.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.customer_campaigns
  drop constraint if exists customer_campaigns_customer_id_campaign_id_key;

-- One active enrollment per (customer, campaign, student). A NULL student
-- (general savings campaigns) collapses to a fixed sentinel so a customer still
-- cannot hold two active enrollments in the same general campaign, while
-- education campaigns can have multiple active enrollments for different students.
create unique index if not exists customer_campaigns_active_cust_camp_student_uq
  on public.customer_campaigns (
    customer_id,
    campaign_id,
    coalesce(student_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status = 'active';

-- One active education campaign per student (matches the enroll-campaign check,
-- enforced at the DB level for integrity). Left/completed rows are excluded so a
-- student can be re-enrolled after leaving.
create unique index if not exists customer_campaigns_one_active_per_student_uq
  on public.customer_campaigns (student_id)
  where status = 'active' and student_id is not null;

-- ─────────────────────────────────────────────────────────────────────────
-- Bug 2 — every active enrollment must have a linked, fundable wallet.
-- Some existing active enrollments have wallet_id = NULL and no wallet at all,
-- so deposits fail with "Could not find wallet". Repair the data here; the
-- enroll-campaign function is also hardened to guarantee this going forward.
-- ─────────────────────────────────────────────────────────────────────────

-- (a) Link active enrollments that already have a wallet row pointing at them.
update public.customer_campaigns cc
   set wallet_id = w.id
  from public.wallets w
 where w.customer_campaign_id = cc.id
   and cc.wallet_id is null;

-- (b) Create a wallet for any active enrollment still lacking one.
insert into public.wallets (customer_id, customer_campaign_id, balance)
select cc.customer_id, cc.id, 0
  from public.customer_campaigns cc
 where cc.status = 'active'
   and cc.wallet_id is null
   and not exists (
     select 1 from public.wallets w where w.customer_campaign_id = cc.id
   );

-- (c) Link those newly created wallets back onto the enrollment row.
update public.customer_campaigns cc
   set wallet_id = w.id
  from public.wallets w
 where w.customer_campaign_id = cc.id
   and cc.wallet_id is null;
