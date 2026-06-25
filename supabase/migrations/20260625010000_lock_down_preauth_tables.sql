-- Security fix: remove public (anon-key) read/write access to customers,
-- otp_verifications and partna_identities.
--
-- Audit findings #10/#11/#12: these tables carried `USING (true)` policies so
-- anyone holding the public anon key could dump every customer's PII, read or
-- tamper with any OTP (defeating phone verification), and enumerate identities.
--
-- The pre-auth operations that needed this access have been moved server-side
-- into Edge Functions running with the service_role (which bypasses RLS):
--   * register-customer-start  — dup checks, identity + customer + OTP creation, SMS
--   * verify-otp               — server-side OTP check, marks customer pin_pending
--   * lookup-login-email       — phone -> auth email for login / forgot-PIN
--
-- After this migration the only remaining access is:
--   * service_role (Edge Functions) — full access, bypasses RLS
--   * authenticated customers — may still read/update their OWN customers row
--     ("Customers read own profile" + customers_update_own). No access at all to
--     otp_verifications / partna_identities from the client.

-- ───────────────────────────── customers ─────────────────────────────
drop policy if exists "Anon can insert customer on registration" on public.customers;
drop policy if exists "Anon can select customer on registration" on public.customers;
revoke insert, select on public.customers from anon;

-- ────────────────────────── otp_verifications ──────────────────────────
drop policy if exists "Anyone can create OTP" on public.otp_verifications;
drop policy if exists "Anyone can read OTP"   on public.otp_verifications;
drop policy if exists "Anyone can update OTP" on public.otp_verifications;
revoke insert, select, update on public.otp_verifications from anon;
revoke insert, select, update on public.otp_verifications from authenticated;

-- ────────────────────────── partna_identities ──────────────────────────
drop policy if exists "Anon can insert partna_identity on registration"  on public.partna_identities;
drop policy if exists "Anon can check phone exists in partna_identities" on public.partna_identities;
revoke insert, select on public.partna_identities from anon;
revoke insert, select on public.partna_identities from authenticated;
