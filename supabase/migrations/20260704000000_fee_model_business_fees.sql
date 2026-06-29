-- ─────────────────────────────────────────────────────────────────────────
-- Fee model overhaul: separate Partna fee from carrier fee, move Partna's cut
-- on education collections from per-payment MDR to the business withdrawal fee,
-- add business withdrawal fees, and reconcile the business wallet balances.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Fix 1 — ensure carrier_fee column exists on transaction_fees ───────────
alter table public.transaction_fees add column if not exists carrier_fee numeric not null default 0;

-- ── Fix 3 — business_transaction_fees: per-business-withdrawal fee tracking ─
create table if not exists public.business_transaction_fees (
  id                       uuid primary key default uuid_generate_v4(),
  business_transaction_id  uuid references public.business_transactions(id) on delete cascade,
  business_id              uuid references public.businesses(id),
  partna_fee               numeric not null default 0,   -- Partna revenue (3%)
  carrier_fee              numeric not null default 0,    -- flat bank-transfer cost (UGX 6,000)
  total_fees               numeric not null default 0,    -- partna_fee + carrier_fee
  net_amount               numeric not null default 0,    -- what the business receives
  created_at               timestamptz default now()
);

alter table public.business_transaction_fees enable row level security;
grant select on public.business_transaction_fees to authenticated;

drop policy if exists btf_service_role_all     on public.business_transaction_fees;
drop policy if exists btf_select_partna_admin   on public.business_transaction_fees;
drop policy if exists btf_select_business_admin on public.business_transaction_fees;

create policy btf_service_role_all on public.business_transaction_fees
  for all to public using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy btf_select_partna_admin on public.business_transaction_fees
  for select to authenticated
  using (exists (select 1 from public.admin_users au where au.email = auth.email()));

create policy btf_select_business_admin on public.business_transaction_fees
  for select to authenticated
  using (exists (select 1 from public.business_admins ba
                 where ba.business_id = business_transaction_fees.business_id
                   and ba.auth_user_id = auth.uid()));

-- ── Fix 4a — fee payment RPC: credit the FULL amount, no MDR ───────────────
-- New model: a customer payment carries NO fee. The business is credited the
-- full amount; Partna recovers its cost from the business withdrawal fee.
create or replace function public.process_fee_payment_tx(
  p_wallet_id          uuid,
  p_customer_id        uuid,
  p_campaign_id        uuid,
  p_student_id         uuid,
  p_business_wallet_id uuid,
  p_amount             numeric,
  p_net_to_school      numeric,
  p_mdr_rate           numeric,
  p_mdr_amount         numeric,
  p_late_fee           numeric,
  p_is_late            boolean,
  p_fee_type           text,
  p_reference          text,
  p_notes              text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_balance numeric;
  v_txn_id uuid;
begin
  select balance into v_parent_balance from wallets where id = p_wallet_id for update;
  if v_parent_balance is null then raise exception 'WALLET_NOT_FOUND'; end if;
  if v_parent_balance < p_amount then raise exception 'INSUFFICIENT_BALANCE'; end if;

  update wallets set balance = v_parent_balance - p_amount, updated_at = now() where id = p_wallet_id;

  -- Credit the school the FULL amount (no MDR deducted).
  update business_wallets set balance = balance + p_amount where id = p_business_wallet_id;
  if not found then raise exception 'BUSINESS_WALLET_NOT_FOUND'; end if;

  insert into transactions (customer_id, wallet_id, campaign_id, student_id, type, amount,
                            gross_amount, net_to_school, mdr_rate, mdr_amount, late_fee_charged,
                            fee_type, status, reference, notes)
  values (p_customer_id, p_wallet_id, p_campaign_id, p_student_id,
          case when p_is_late then 'late_fee_payment' else 'fee_payment' end,
          p_amount, p_amount, p_amount, 0, 0, p_late_fee,
          p_fee_type, 'completed', p_reference, p_notes)
  returning id into v_txn_id;

  -- No transaction_fees row: there is no Partna fee on a customer payment.
  return jsonb_build_object('transaction_id', v_txn_id, 'new_parent_balance', v_parent_balance - p_amount);
end;
$$;

-- ── Fix 4b — business withdrawal RPC (atomic, service-role only) ────────────
create or replace function public.process_business_withdrawal_tx(
  p_business_id     uuid,
  p_amount          numeric,
  p_partna_fee      numeric,
  p_carrier_fee     numeric,
  p_total_fees      numeric,
  p_net_amount      numeric,
  p_notes           text,
  p_method          text,
  p_account_name    text,
  p_account_number  text,
  p_notify_phone    text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id uuid;
  v_balance   numeric;
  v_txn_id    uuid;
begin
  select id, balance into v_wallet_id, v_balance from business_wallets where business_id = p_business_id for update;
  if v_wallet_id is null then raise exception 'WALLET_NOT_FOUND'; end if;
  if v_balance < p_amount then raise exception 'INSUFFICIENT_BALANCE'; end if;

  update business_wallets set balance = v_balance - p_amount where id = v_wallet_id;

  insert into business_transactions (business_id, wallet_id, type, amount, status, notes,
                                     withdrawal_method, withdrawal_account_name, withdrawal_account_number, withdrawal_notify_phone)
  values (p_business_id, v_wallet_id, 'withdrawal', p_amount, 'pending', p_notes,
          p_method, p_account_name, p_account_number, p_notify_phone)
  returning id into v_txn_id;

  insert into business_transaction_fees (business_transaction_id, business_id, partna_fee, carrier_fee, total_fees, net_amount)
  values (v_txn_id, p_business_id, p_partna_fee, p_carrier_fee, p_total_fees, p_net_amount);

  return jsonb_build_object('transaction_id', v_txn_id, 'new_balance', v_balance - p_amount);
end;
$$;

revoke all on function public.process_business_withdrawal_tx(uuid,numeric,numeric,numeric,numeric,numeric,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.process_business_withdrawal_tx(uuid,numeric,numeric,numeric,numeric,numeric,text,text,text,text,text) to service_role;

-- ── Fix 4c — drop legacy MDR fee rows (no Partna fee on payments anymore) ───
delete from public.transaction_fees where fee_type = 'mdr';

-- ── Fix 4d — reconcile every business wallet balance ───────────────────────
-- balance = (full completed fee payments collected) − (business withdrawals out)
update public.business_wallets bw set balance =
  coalesce((
    select sum(t.amount) from public.transactions t
    join public.customers c on c.id = t.customer_id
    where c.business_id = bw.business_id
      and t.type in ('fee_payment', 'late_fee_payment')
      and t.status = 'completed'
  ), 0)
  -
  coalesce((
    select sum(bt.amount) from public.business_transactions bt
    where bt.business_id = bw.business_id
      and bt.type = 'withdrawal'
      and bt.status in ('pending', 'completed')
  ), 0);
