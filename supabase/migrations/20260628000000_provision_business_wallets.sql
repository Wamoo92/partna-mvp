-- Bug 1 fix: education fee payment failed with "School wallet not found" because a
-- business had no business_wallets row. Provision one per business and enforce
-- one-wallet-per-business so the Edge Function's auto-provision is race-safe.

-- 1. Defensive de-dup (keep the highest-balance row per business) before the unique key.
delete from public.business_wallets bw
using public.business_wallets keep
where bw.business_id = keep.business_id
  and bw.id <> keep.id
  and (keep.balance, keep.id) > (bw.balance, bw.id);

-- 2. One wallet per business.
alter table public.business_wallets
  add constraint business_wallets_business_id_key unique (business_id);

-- 3. Provision a wallet for every business that doesn't have one yet.
insert into public.business_wallets (business_id, balance)
select b.id, 0
from public.businesses b
where not exists (select 1 from public.business_wallets bw where bw.business_id = b.id);
