-- E-1 / E-2 fix: atomic, idempotent, amount-verified wallet credit for Pesapal deposits.
--
-- Replaces the previous client/URL-trusting credit logic in pesapal-callback and
-- pesapal-ipn. The wallet credit, the pending->completed transition and the amount
-- check all happen inside ONE transaction under a row lock, so:
--   * a payment can only ever be credited ONCE (idempotent across callback + IPN +
--     browser refreshes + Pesapal retries) — fixes E-2 double-credit.
--   * the credited amount is the server-stored transaction amount, never a value
--     supplied in the callback URL — fixes E-1 amount forgery.
--   * the Pesapal-verified amount (passed in by the caller after querying
--     GetTransactionStatus) must match the stored amount, or the credit is refused
--     and the transaction is marked failed.
--
-- Execution is restricted to service_role only, so it cannot be called by the
-- anon/authenticated client to credit wallets.

create or replace function public.process_pesapal_credit(
  p_reference         text,
  p_order_tracking_id text,
  p_verified_amount   numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn         transactions%rowtype;
  v_new_balance numeric;
begin
  -- Lock the deposit row so concurrent callback / IPN calls serialise here.
  select * into v_txn
  from transactions
  where reference = p_reference
  for update;

  if not found then
    return jsonb_build_object('result', 'not_found');
  end if;

  -- Idempotency: only a still-pending deposit may be credited. A second caller
  -- (IPN after callback, a retry, a refresh) sees 'completed' and no-ops.
  if v_txn.status <> 'pending' then
    return jsonb_build_object('result', 'already_processed', 'txn_status', v_txn.status);
  end if;

  -- Amount integrity: the amount Pesapal verified must equal what we stored at
  -- initiation. Refuse (and fail the txn) on mismatch or a missing verified amount.
  if p_verified_amount is null
     or round(p_verified_amount::numeric) <> round(v_txn.amount::numeric) then
    update transactions
       set status = 'failed',
           notes  = 'Amount verification failed. verified=' || coalesce(p_verified_amount::text, 'null')
                    || ' expected=' || v_txn.amount::text
     where id = v_txn.id;
    return jsonb_build_object('result', 'amount_mismatch',
                             'expected', v_txn.amount, 'verified', p_verified_amount);
  end if;

  -- Atomic credit + state transition.
  update wallets
     set balance    = coalesce(balance, 0) + v_txn.amount,
         updated_at = now()
   where id = v_txn.wallet_id
   returning balance into v_new_balance;

  update transactions
     set status = 'completed',
         notes  = 'Pesapal confirmed. order_tracking_id: ' || p_order_tracking_id
   where id = v_txn.id;

  return jsonb_build_object(
    'result',      'credited',
    'amount',      v_txn.amount,
    'new_balance', v_new_balance,
    'customer_id', v_txn.customer_id,
    'campaign_id', v_txn.campaign_id,
    'wallet_id',   v_txn.wallet_id
  );
end;
$$;

revoke all on function public.process_pesapal_credit(text, text, numeric) from public;
grant execute on function public.process_pesapal_credit(text, text, numeric) to service_role;
