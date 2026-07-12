-- ============================================================
-- REGO — Phase 41: Solo connection → seat reservation fields
-- Adds seat/date/pickup to solo_connections so "Connect" becomes a quick
-- seat-reservation request. Safe to run on an existing phase40 install.
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

alter table public.solo_connections
  add column if not exists seats       int not null default 1,
  add column if not exists travel_date date,
  add column if not exists pickup      text;
