-- Deferred Block 2 security fixes (A-3, A-4): remove the direct authenticated
-- INSERT/UPDATE policies on wallets and escrow_wallets.
--
-- These were held back in Block 2 Option B because the customer portal still wrote
-- balances directly from the browser. Those flows are now server-side, behind
-- service-role Edge Functions with JWT + ownership checks:
--   * enroll-campaign          (creates the wallet)
--   * process-general-payment  (debits wallet, credits escrow, records sale)
--   * process-withdrawal       (debits wallet)
--   * leave-campaign           (zeroes wallet, refund)
--   * close-account            (zeroes wallets, refunds, deactivates)
-- Education fee payment (process-fee-payment) and Pesapal deposits
-- (process_pesapal_credit) were already server-side.
--
-- After this migration, authenticated clients can SELECT their own wallet/escrow
-- rows but cannot INSERT/UPDATE them — only the service_role (Edge Functions) can,
-- via the existing *_service_role_all policies. This closes the balance-forgery
-- hole (a customer could otherwise set balance = 999999).
--
-- NOT included (deferred again): revoking authenticated DML on business_admins
-- (A-5 authenticated half). That breaks dashboard invite-acceptance / admin
-- management, which have no server-side replacement yet — it belongs in a
-- dashboard-hardening block.

drop policy if exists wallets_insert_own on public.wallets;
drop policy if exists wallets_update_own on public.wallets;

drop policy if exists escrow_wallets_insert_own_business on public.escrow_wallets;
drop policy if exists escrow_wallets_update_own_business on public.escrow_wallets;
