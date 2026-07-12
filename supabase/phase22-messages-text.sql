-- ============================================================
-- SAFARIGB — Phase 22: messages.booking_id → text
-- The chat thread id is now also used for admin↔owner support threads
-- ("admin::<ownerEmail>"), which aren't UUIDs. Widen booking_id to text so it
-- accepts both booking UUIDs and these synthetic thread ids.
-- Safe: existing UUID values convert to their text form; no FK exists.
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

alter table public.messages
  alter column booking_id type text using booking_id::text;
