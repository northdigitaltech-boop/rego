-- ============================================================
-- Phase 61 — Real ratings only
-- A listing must never display a score it hasn't earned. Any row that
-- carries a rating but has ZERO reviews is reset to 0, and the old
-- `hotels` default of 4.5 is changed to 0.
-- The UI shows a "New" badge when reviews = 0, and the real average
-- once travellers start rating. Safe & idempotent to re-run.
-- ============================================================

-- Old default gave brand-new hotels a free 4.5 stars.
alter table if exists public.hotels alter column rating set default 0;

do $$
declare t text;
begin
  foreach t in array array[
    'hotels','homestays','hostels',
    'tour_companies','tour_packages','tour_guides',
    'transport_providers','transport_services','transport_rentals',
    'media_providers','restaurants','activities',
    'coworking_spaces','roadside_providers',
    'expedition_companies','solo_travelers'
  ] loop
    -- Only touch tables that actually exist in this project.
    if to_regclass('public.' || t) is not null then
      -- Zero the rating wherever there are no reviews backing it up.
      begin
        execute format(
          'update public.%I set rating = 0 where coalesce(reviews, 0) = 0 and coalesce(rating, 0) <> 0', t
        );
      exception when undefined_column then
        -- Some tables call the counter total_reviews instead.
        begin
          execute format(
            'update public.%I set rating = 0 where coalesce(total_reviews, 0) = 0 and coalesce(rating, 0) <> 0', t
          );
        exception when undefined_column then
          null; -- no review counter on this table — skip it
        end;
      end;
    end if;
  end loop;
end $$;
