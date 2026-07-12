-- ============================================================
-- SAFARIGB — Phase 4b: multiple hotel photos (gallery)
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

alter table public.hotels
  add column if not exists gallery text[] default '{}';
