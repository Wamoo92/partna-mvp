-- ─────────────────────────────────────────────────────────────────────────
-- Medium 1 — wrap the money-movement of process-withdrawal, process-fee-payment
-- and process-general-payment in single DB transactions. Each Edge Function used
-- to debit the wallet, then insert the transaction, then insert transaction_fees
-- as separate statements; if a later step failed the wallet stayed debited.
-- These SECURITY DEFINER RPCs lock the wallet row (FOR UPDATE), re-check the
-- balance, and perform every write in one transaction — any error rolls back the
-- whole thing. They are callable by the service role only (the Edge Functions).
-- ─────────────────────────────────────────────────────────────────────────

-- ── Withdrawal: debit wallet, record pending withdrawal + its fees ──────────
create or replace function public.process_withdrawal_tx(
  p_wallet_id         uuid,
  p_customer_id       uuid,
  p_campaign_id       uuid,
  p_amount            numeric,
  p_network           text,
  p_withdrawal_phone  text,
  p_reference         text,
  p_notes             text,
  p_partna_fee        numeric,
  p_carrier_fee       numeric,
  p_total_fees        numeric,
  p_net_amount        numeric
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric;
  v_txn_id  uuid;
begin
  select balance into v_balance from wallets where id = p_wallet_id for update;
  if v_balance is null then raise exception 'WALLET_NOT_FOUND'; end if;
  if v_balance < p_amount then raise exception 'INSUFFICIENT_BALANCE'; end if;

  update wallets set balance = v_balance - p_amount, updated_at = now() where id = p_wallet_id;

  insert into transactions (customer_id, wallet_id, campaign_id, type, amount, status,
                            network, withdrawal_network, withdrawal_phone, reference, notes)
  values (p_customer_id, p_wallet_id, p_campaign_id, 'withdrawal', p_amount, 'pending',
          p_network, p_network, p_withdrawal_phone, p_reference, p_notes)
  returning id into v_txn_id;

  insert into transaction_fees (transaction_id, customer_id, network, fee_type, charged_to,
                                partna_fee, carrier_fee, tax, total_fees, net_amount)
  values (v_txn_id, p_customer_id, p_network, 'withdrawal', 'user',
          p_partna_fee, p_carrier_fee, 0, p_total_fees, p_net_amount);

  return jsonb_build_object('transaction_id', v_txn_id, 'new_balance', v_balance - p_amount);
end;
$$;

-- ── Education fee payment: debit parent, credit school, record txn + MDR fee ─
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

  update business_wallets set balance = balance + p_net_to_school where id = p_business_wallet_id;
  if not found then raise exception 'BUSINESS_WALLET_NOT_FOUND'; end if;

  insert into transactions (customer_id, wallet_id, campaign_id, student_id, type, amount,
                            gross_amount, net_to_school, mdr_rate, mdr_amount, late_fee_charged,
                            fee_type, status, reference, notes)
  values (p_customer_id, p_wallet_id, p_campaign_id, p_student_id,
          case when p_is_late then 'late_fee_payment' else 'fee_payment' end,
          p_amount, p_amount, p_net_to_school, p_mdr_rate, p_mdr_amount, p_late_fee,
          p_fee_type, 'completed', p_reference, p_notes)
  returning id into v_txn_id;

  insert into transaction_fees (transaction_id, customer_id, fee_type, charged_to,
                                partna_fee, carrier_fee, tax, total_fees, net_amount)
  values (v_txn_id, p_customer_id, 'mdr', 'business', p_mdr_amount, 0, 0, p_mdr_amount, p_net_to_school);

  return jsonb_build_object('transaction_id', v_txn_id, 'new_parent_balance', v_parent_balance - p_amount);
end;
$$;

-- ── General savings payment: debit wallet, record txn + fee, escrow + sale ──
create or replace function public.process_general_payment_tx(
  p_wallet_id    uuid,
  p_customer_id  uuid,
  p_campaign_id  uuid,
  p_business_id  uuid,
  p_amount       numeric,
  p_partna_fee   numeric,
  p_full_payment boolean,
  p_discount_id  uuid,
  p_reference    text,
  p_notes        text,
  p_sale_notes   text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric;
  v_txn_id  uuid;
begin
  select balance into v_balance from wallets where id = p_wallet_id for update;
  if v_balance is null then raise exception 'WALLET_NOT_FOUND'; end if;
  if v_balance < p_amount then raise exception 'INSUFFICIENT_BALANCE'; end if;

  update wallets set balance = v_balance - p_amount, updated_at = now() where id = p_wallet_id;

  insert into transactions (customer_id, wallet_id, campaign_id, type, amount, status, reference, notes)
  values (p_customer_id, p_wallet_id, p_campaign_id, 'payment', p_amount, 'completed', p_reference, p_notes)
  returning id into v_txn_id;

  insert into transaction_fees (transaction_id, customer_id, fee_type, charged_to,
                                partna_fee, carrier_fee, tax, total_fees, net_amount)
  values (v_txn_id, p_customer_id, 'payment', 'business', p_partna_fee, 0, 0, p_partna_fee, p_amount - p_partna_fee);

  if p_full_payment then
    update escrow_wallets set balance = balance + p_amount where business_id = p_business_id;
    if not found then
      insert into escrow_wallets (business_id, balance) values (p_business_id, p_amount);
    end if;
    insert into sales (business_id, customer_id, campaign_id, transaction_id, amount, type, status, is_prize, notes)
    values (p_business_id, p_customer_id, p_campaign_id, v_txn_id, p_amount, 'retail', 'pending', false, p_sale_notes);
  end if;

  if p_discount_id is not null then
    update customer_discounts set is_used = true where id = p_discount_id;
  end if;

  return jsonb_build_object('transaction_id', v_txn_id, 'new_balance', v_balance - p_amount);
end;
$$;

-- Callable by the service role only (the Edge Functions). Never directly by clients.
revoke all on function public.process_withdrawal_tx(uuid,uuid,uuid,numeric,text,text,text,text,numeric,numeric,numeric,numeric) from public, anon, authenticated;
revoke all on function public.process_fee_payment_tx(uuid,uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric,numeric,boolean,text,text,text) from public, anon, authenticated;
revoke all on function public.process_general_payment_tx(uuid,uuid,uuid,uuid,numeric,numeric,boolean,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.process_withdrawal_tx(uuid,uuid,uuid,numeric,text,text,text,text,numeric,numeric,numeric,numeric) to service_role;
grant execute on function public.process_fee_payment_tx(uuid,uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric,numeric,boolean,text,text,text) to service_role;
grant execute on function public.process_general_payment_tx(uuid,uuid,uuid,uuid,numeric,numeric,boolean,uuid,text,text,text) to service_role;
