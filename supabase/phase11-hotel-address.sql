-- ============================================================
-- SAFARIGB — Phase 11: complete address for hotels / resorts
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

alter table public.hotels
  add column if not exists address text;
