-- ============================================================
-- SAFARIGB — Phase 15: shared booking chat (hotels + homestays)
-- The messages table originally referenced bookings(id). Homestay bookings
-- live in a separate table, so we drop that FK and keep booking_id as a plain
-- uuid. Messages are still scoped per booking id (unique across both tables).
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

alter table public.messages
  drop constraint if exists messages_booking_id_fkey;
