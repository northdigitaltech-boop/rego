-- ============================================================
-- SAFARIGB — Phase 33: Roadside live location tracking
-- Adds the provider's last-known GPS position + a tracking flag to
-- roadside_requests. Live position ticks travel over a Supabase Realtime
-- broadcast channel (no DB write per tick); these columns store the last
-- position so a customer who opens the page mid-trip still sees the marker.
--
-- Access control is unchanged: the existing phase32 policies already let the
-- provider (owner_email) update their own request and the customer read it.
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

alter table public.roadside_requests
  add column if not exists provider_lat        double precision,
  add column if not exists provider_lng        double precision,
  add column if not exists provider_location_at timestamptz,
  add column if not exists tracking_active      boolean not null default false;
