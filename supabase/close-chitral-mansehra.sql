-- ============================================================
-- Take Chitral and Mansehra out of the listing forms.
--
-- No deploy needed. This is a setting, not code — the picker
-- reads it live, so the next page load is enough.
--
-- ---------------------------------------------------------------------------
-- WHY THEY ARE THERE
--
-- Nothing hardcodes that list. "Areas you operate in" is
-- whatever areas_open_for_listings_tree() returns, which is
-- every location where all three of these resolve true:
--
--     is_active
--     is_public
--     listings_enabled   (per service, falling back to the location)
--
-- So Chitral and Mansehra are on that list because something
-- switched New listings on for them — either on the row itself,
-- or on an ancestor they inherit from. Both are Khyber
-- Pakhtunkhwa districts, so a KP-wide switch would do it.
--
-- WHY SET false AND NOT NULL
--   NULL means "inherit". If the parent is on, NULL leaves them
--   exactly where they are. `false` is the explicit answer and is
--   what makes this stick regardless of what KP says.
--
-- WHY NOT DELETE THE LOCATIONS
--   locations.id is referenced by service_locations and by the
--   provider rows that point at it, with `on delete cascade` in
--   places. Deleting a district to hide it from one dropdown can
--   take real coverage rows with it. Closing it costs nothing and
--   is one word to undo.
-- ---------------------------------------------------------------------------


-- ------------------------------------------------------------
-- 1. BEFORE — what is actually on, and where the value comes from
--
-- Run this first. If `listings_origin` says 'inherited', the
-- switch is on an ancestor, and query 3 shows which one.
-- ------------------------------------------------------------
select
  l.id,
  l.name,
  array_to_string(l.path_slugs, ' / ')                            as path,
  l.location_type,
  l.listings_enabled                                              as own_value,
  public.resolve_location_flag(l.id, 'listings_enabled')          as resolves_to,
  public.location_flag_origin(l.id, 'listings_enabled')           as listings_origin,
  public.resolve_location_flag(l.id, 'is_public')                 as public_now
from public.locations l
where lower(l.name) in ('chitral', 'mansehra')
order by l.name;


-- ------------------------------------------------------------
-- 2. CLOSE THEM
--
-- Matched on name AND location_type so this cannot catch an
-- unrelated row — "Chitral" may exist as both a district and a
-- town, and both should close.
--
-- is_public is left alone deliberately. That switch is what
-- travellers reading the site see; this one is what providers
-- registering are offered. Closing the form does not have to
-- take the page down, and if you do want the page gone too,
-- that is a separate decision made on purpose.
-- ------------------------------------------------------------
update public.locations
   set listings_enabled = false,
       updated_at       = now()
 where lower(name) in ('chitral', 'mansehra');

-- Clear any per-service override that would otherwise win over the
-- row above. A service-level `true` beats a location-level `false`.
update public.location_service_settings s
   set listings_enabled = false,
       updated_at       = now()
  from public.locations l
 where s.location_id = l.id
   and lower(l.name) in ('chitral', 'mansehra')
   and coalesce(s.listings_enabled, false) is true;


-- ------------------------------------------------------------
-- 3. AFTER — confirm, and see the whole list that remains
--
-- `resolves_to` must now be false for both.
-- ------------------------------------------------------------
select
  l.name,
  l.listings_enabled                                     as own_value,
  public.resolve_location_flag(l.id, 'listings_enabled')  as resolves_to
from public.locations l
where lower(l.name) in ('chitral', 'mansehra')
order by l.name;

-- Everything a travel company is offered now. Chitral and
-- Mansehra should be absent; anything else unexpected here can be
-- closed the same way.
select
  repeat('    ', depth) || name as offered_in_the_form,
  location_type
from public.areas_open_for_listings_tree('travel-companies')
order by depth, name;


-- ============================================================
-- ALREADY-TICKED PROVIDERS
--
-- Closing an area stops NEW listings choosing it. It does not
-- retract a company that already ticked it — that coverage row
-- stays, and so does their appearance in a search for it.
-- Deliberate: silently dropping coverage a provider entered
-- would change their listing without telling them.
--
-- Who, if anyone, is affected:
--
--   select sl.listing_table, sl.listing_id, l.name as area
--     from public.service_locations sl
--     join public.locations l on l.id = sl.location_id
--    where lower(l.name) in ('chitral', 'mansehra');
--
-- If that returns nothing, there is nothing else to think about.
-- ============================================================


-- ============================================================
-- ROLLBACK — puts both back exactly as they were
--
--   update public.locations
--      set listings_enabled = null, updated_at = now()
--    where lower(name) in ('chitral', 'mansehra');
--
-- NULL, not true: null restores "inherit from the parent",
-- which is what the rows held before this file ran if query 1
-- reported their origin as 'inherited'. If query 1 showed
-- 'override_location' with own_value true, use true instead.
-- ============================================================
