-- Fix: several writes were silently rejected by stale CHECK constraints / missing
-- columns, so the actions "succeeded" in the UI but never persisted.
--
-- 1. transactions_type_check forbade 'fee_payment' and 'late_fee_payment', but
--    process-fee-payment inserts exactly those. Every education fee payment
--    therefore failed to record a transaction (the function logged and moved on),
--    so get_student_payment_total summed nothing and student "paid to date" /
--    "minimum registration met" always read 0. THIS BROKE EDUCATION FEE TRACKING.
-- 2. transactions_status_check forbade 'reversed', so the admin "reverse
--    transaction" action violated the constraint and never persisted.
-- 3. transactions.processed_at column did not exist, so the admin "mark withdrawal
--    processed" update errored and was swallowed.

alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions add  constraint transactions_type_check
  check (type = any (array[
    'deposit','withdrawal','payment','fee_payment','late_fee_payment','reward_credit'
  ]));

alter table public.transactions drop constraint if exists transactions_status_check;
alter table public.transactions add  constraint transactions_status_check
  check (status = any (array['pending','completed','failed','reversed']));

alter table public.transactions add column if not exists processed_at timestamptz;
