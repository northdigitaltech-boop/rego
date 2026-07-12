-- ============================================================
-- SAFARIGB — Phase 5b: extra customer details on bookings
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

alter table public.bookings add column if not exists customer_phone text;
alter table public.bookings add column if not exists customer_city text;
alter table public.bookings add column if not exists notes text;
