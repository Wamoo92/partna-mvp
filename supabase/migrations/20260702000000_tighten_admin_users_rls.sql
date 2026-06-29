-- ─────────────────────────────────────────────────────────────────────────
-- High 1 — admin_users was world-readable to every authenticated user.
-- The policy "Authenticated users can read admin_users" used USING(true), so any
-- customer or business admin could read the full list of Partna admin emails
-- (enabling targeted phishing). Restrict reads to the row matching the caller's
-- own email. The service-role policy (used by send-sms/send-admin-email auth and
-- by server functions) is unaffected and still has full access.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "Authenticated users can read admin_users" on public.admin_users;

create policy admin_users_select_self on public.admin_users
  for select to authenticated
  using (lower(email) = lower(auth.email()));
