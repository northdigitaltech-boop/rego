-- ============================================================
-- SAFARIGB — Phase 28: Admin-controlled ranking badge
-- Adds a `ranking_badge` text column to every listing/provider table so an
-- admin can assign a badge (e.g. "Top Rated") per listing instead of it being
-- auto-derived from rating.
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array[
    'hotels','homestays','tour_packages','tour_companies','rental_vehicles',
    'transport_services','transport_providers','tour_guides','media_providers','restaurants'
  ] loop
    execute format('alter table public.%I add column if not exists ranking_badge text;', t);
  end loop;
end $$;
