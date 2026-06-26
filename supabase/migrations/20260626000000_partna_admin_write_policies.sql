-- Fix (Area 1): Partna admin-panel writes silently did nothing.
--
-- The admin panel runs as an authenticated user (admin) against the anon client.
-- Every admin write — approving KYC, flagging customers, KYB status, manual
-- refunds, wallet reversals, merchant/cashback/package/platform settings — hit
-- RLS with NO matching policy. UPDATEs therefore affected 0 rows WITHOUT raising an
-- error (PostgREST returns 200), and INSERTs failed with errors the UI swallowed.
-- Result: the UI looked like it worked but nothing persisted.
--
-- Fix: give the Partna admin role (membership in admin_users by email, matching the
-- existing "Partna admins can read all ..." policies) full access to the tables the
-- admin panel writes. Also grant the underlying table privileges on the three
-- tables where authenticated had none (cashback_tiers, platform_settings,
-- audit_logs) — RLS still restricts writes to admins.

-- ── Missing table grants (RLS still gates to admins via the policies below) ──
grant select, insert, update, delete on public.cashback_tiers     to authenticated;
grant select, insert, update, delete on public.platform_settings  to authenticated;
grant select, insert, update, delete on public.audit_logs         to authenticated;

-- ── Partna-admin full access on every admin-written table ──
do $$
declare
  t text;
  admin_check constant text :=
    '((select admin_users.email from public.admin_users where admin_users.email = auth.email()) is not null)';
begin
  foreach t in array array[
    'businesses','campaigns','customers','transactions','wallets','business_wallets',
    'merchants','cashback_tiers','platform_settings','subscription_packages','audit_logs'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_partna_admin_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using %s with check %s',
      t || '_partna_admin_all', t, admin_check, admin_check
    );
  end loop;
end $$;
