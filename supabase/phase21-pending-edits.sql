-- ============================================================
-- SAFARIGB — Phase 21: Edit re-approval (moderation of changes)
-- When an owner edits an already-approved listing, the new values are stored
-- in pending_changes (the live row stays unchanged so customers keep seeing the
-- approved version) until an admin approves them.
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array[
    'hotels','homestays','tour_companies','tour_packages','transports',
    'tour_guides','transport_providers','transport_services','rental_vehicles',
    'media_providers'
  ] loop
    execute format('alter table public.%s add column if not exists pending_changes jsonb', t);
    execute format('alter table public.%s add column if not exists pending_at timestamptz', t);
  end loop;
end $$;
