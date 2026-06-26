-- Fix (Area 1): the admin "flag account" action wrote customers.is_flagged, but the
-- column did not exist, so the update errored and was swallowed by the UI. Add it.
alter table public.customers add column if not exists is_flagged boolean not null default false;
