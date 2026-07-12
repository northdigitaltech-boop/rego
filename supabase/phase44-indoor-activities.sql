-- ============================================================
-- REGO — Phase 44: Indoor Activities & Experiences
-- Adds indoor activities to the EXISTING Activities module (same table, same
-- RLS, same admin). Two new columns:
--   activity_kind  — 'outdoor' (default) | 'indoor'
--   opening_hours  — for indoor venues (e.g. "10am–10pm")
-- Indoor activity types are stored in the existing `category` column using new
-- slugs (indoor-photography-studio, snooker-club, gaming-zone, swimming-pool,
-- art-handicraft-workshop, storytelling-safarnama).
-- Safe to run on an existing phase39 install.
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

alter table public.activities
  add column if not exists activity_kind text not null default 'outdoor',
  add column if not exists opening_hours text;

create index if not exists activities_kind_idx on public.activities (activity_kind);
