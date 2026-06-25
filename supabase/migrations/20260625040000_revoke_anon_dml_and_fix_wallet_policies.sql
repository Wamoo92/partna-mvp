-- Block: revoke anon DML on financial/operational tables (zero-impact hardening).
--
-- Audit refs applied here: A-1, A-2 (anon ledger writes), A-5 anon half
-- (business_admins), A-6/7/8 (anon business/operational writes), A-10/13
-- (anon campaigns/packages writes).
--
-- Scope decision (option B): this migration contains ONLY the changes that have
-- zero functional impact. anon has no matching RLS policy on any of these tables
-- today, so it already cannot write them — revoking the grant just removes the
-- latent "one loose policy away from compromise" risk. SELECT grants are left in
-- place (anon subdomain lookup on businesses, read paths, pricing pages).
--
-- DEFERRED to the Edge Function block (NOT in this migration), because they break
-- live authenticated client flows until those flows are moved server-side:
--   * A-3: drop wallets_insert_own / wallets_update_own
--          (breaks enrollment wallet creation, general-pay, withdraw, leave/delete)
--   * A-4: drop escrow_wallets_insert_own_business / _update_own_business
--          (breaks general-pay full-payment escrow, dashboard sale release)
--   * A-5 authenticated half: revoke I/U/D on business_admins from authenticated
--          (breaks dashboard invite acceptance + Settings invite/remove admin)
-- The service_role ALL policies on wallets and escrow_wallets already exist, so
-- those drops will be safe once the replacement Edge Functions are in place.

-- ============================================================================
-- Fix 1 (A-1, A-2) — revoke anon write on customer financial / ledger tables
-- ============================================================================
revoke insert, update, delete on table public.wallets          from anon;
revoke insert, update, delete on table public.transactions     from anon;
revoke insert, update, delete on table public.transaction_fees from anon;
revoke insert, update, delete on table public.escrow_wallets   from anon;

-- ============================================================================
-- Fix 4 (A-5) — anon half only: business_admins must not be writable by anon.
-- (The authenticated revoke is deferred — see header — to avoid breaking the
-- client-side invite-acceptance flow before it is moved to the service role.)
-- ============================================================================
revoke insert, update, delete on table public.business_admins from anon;

-- ============================================================================
-- Fix 5 (A-6, A-7, A-8) — revoke anon write on business + operational tables.
-- (businesses keeps anon SELECT for subdomain portal lookup.)
-- ============================================================================
revoke insert, update, delete on table public.businesses             from anon;
revoke insert, update, delete on table public.business_wallets       from anon;
revoke insert, update, delete on table public.business_transactions  from anon;
revoke insert, update, delete on table public.business_subscriptions from anon;
revoke insert, update, delete on table public.business_cards         from anon;
revoke insert, update, delete on table public.prize_pot_wallets      from anon;
revoke insert, update, delete on table public.withdrawal_requests    from anon;
revoke insert, update, delete on table public.payment_schedules      from anon;

-- ============================================================================
-- Fix 6 (A-10, A-13) — revoke anon write on campaigns and subscription_packages.
-- ============================================================================
revoke insert, update, delete on table public.campaigns             from anon;
revoke insert, update, delete on table public.subscription_packages from anon;
