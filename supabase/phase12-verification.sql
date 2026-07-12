-- ============================================================
-- SAFARIGB — Phase 12: property verification (certification & registration)
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

alter table public.hotels
  add column if not exists reg_number     text,    -- business / property registration or license number
  add column if not exists license_doc    text,    -- uploaded certificate / tourism license (image URL)
  add column if not exists owner_cnic      text,    -- owner national ID (CNIC) number
  add column if not exists owner_cnic_doc  text,    -- uploaded photo of owner ID
  add column if not exists ownership_doc   text,    -- uploaded ownership / lease proof
  add column if not exists verified        boolean not null default false;
