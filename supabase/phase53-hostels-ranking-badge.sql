-- phase53-hostels-ranking-badge.sql
-- The `hostels` table was created in phase48, AFTER phase28-ranking-badge.sql
-- ran its loop over the then-existing listing tables — so it never received the
-- `ranking_badge` column. The public hostels query (PUBLIC_HOSTEL_COLUMNS)
-- selects `ranking_badge`, which fails at runtime with
--   "column hostels.ranking_badge does not exist"
-- and causes getHostels() to return an empty list.
--
-- This migration adds the missing column, matching the `text` type used by every
-- other listing/provider table. Safe to run multiple times.

alter table public.hostels add column if not exists ranking_badge text;
