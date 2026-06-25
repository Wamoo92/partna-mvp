-- Fix: enroll-campaign returned 500 "Could not create wallet".
--
-- wallets carried UNIQUE (customer_id) (wallets_customer_id_key), limiting each
-- customer to ONE wallet total. But the application's design is one wallet PER
-- enrollment: wallets.customer_campaign_id links a wallet to a specific
-- customer_campaigns row, and Pay/Withdraw/Home all load the enrollment's own
-- wallet (customer_campaigns -> wallets). Customers can also join multiple
-- campaigns. So creating a wallet for a customer who already has one — a second
-- enrolment, or a leftover/orphaned wallet — fails with 23505 duplicate key,
-- which enroll-campaign surfaces as "Could not create wallet."
--
-- Drop the obsolete constraint so per-enrollment wallets can be created. This only
-- removes a restriction; no existing data becomes invalid.

alter table public.wallets drop constraint if exists wallets_customer_id_key;

-- Same legacy pattern on cards: the on_wallet_created trigger (create_card_for_wallet)
-- inserts one card PER wallet, and cards already enforces the correct per-wallet
-- uniqueness via cards_wallet_id_key UNIQUE (wallet_id). But cards also carried
-- UNIQUE (customer_id) (cards_customer_id_key), limiting a customer to one card —
-- so creating a second wallet's card failed with 23505, which (firing inside the
-- wallet INSERT trigger) made enroll-campaign fail the same way. Drop it; keep the
-- per-wallet and per-card-number unique constraints.

alter table public.cards drop constraint if exists cards_customer_id_key;
