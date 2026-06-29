-- ─────────────────────────────────────────────────────────────────────────
-- Issue 3 — Cashback section showed "You are at the highest tier" at 0% saved.
-- cashback_tiers had RLS enabled with ONLY a Partna-admin policy, so customers
-- read zero tier rows. With no tiers loaded, CardDetail's "next tier" lookup
-- returned undefined and the code fell through to the hardcoded highest-tier text.
-- cashback_tiers is reference data (tier thresholds + rates) — let any authenticated
-- user read it. Writes remain admin-only via the existing admin policy.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists cashback_tiers_authenticated_read on public.cashback_tiers;
create policy cashback_tiers_authenticated_read on public.cashback_tiers
  for select to authenticated
  using (true);
