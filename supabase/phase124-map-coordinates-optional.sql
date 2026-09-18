-- ============================================================
-- phase124 — a map place may be recorded before it is located.
--
-- WHAT THIS DOES
--   Drops the NOT NULL constraint on map_places.latitude and
--   map_places.longitude.
--
-- WHY
--   Rescue 1122 has stations whose phone number, district and
--   town are known and whose exact coordinates are not. Under
--   NOT NULL the only ways to record one were to invent a
--   coordinate or to leave the station out of the system
--   entirely. Both are worse than an honest blank: an invented
--   coordinate on an emergency service is a pin that sends
--   someone to the wrong place, and a missing record is a phone
--   number nobody can find.
--
--   Null now means "not located yet". It never means 0,0 — that
--   is a real point in the Gulf of Guinea, and a marker there is
--   worse than no marker.
--
-- WHAT STILL HOLDS
--   Existing rows are untouched; every one of them already has
--   coordinates, so nothing becomes null by running this. The
--   application treats a place with no coordinates as listable
--   but not drawable: isLocated() in src/lib/rego-map.ts gates
--   the markers, the Directions link and the Center button.
--
-- SAFETY
--   Loosening a constraint cannot fail on existing data and
--   cannot lose any. It is re-runnable.
-- ============================================================

alter table public.map_places alter column latitude  drop not null;
alter table public.map_places alter column longitude drop not null;

comment on column public.map_places.latitude is
  'Null until the exact location is confirmed. A place with no coordinates is listed but never drawn on the map.';
comment on column public.map_places.longitude is
  'Null until the exact location is confirmed. A place with no coordinates is listed but never drawn on the map.';

-- ------------------------------------------------------------
-- Repair, only if phase123 was run before this file existed.
--
-- That earlier version could not store a blank, so it recorded
-- the five unconfirmed Rescue 1122 stations at their district's
-- coordinates and marked them PIN NOT VERIFIED. Now that null is
-- allowed, the honest value is null.
--
-- Deliberately narrow: only rows still carrying the marker, still
-- unverified and still unpublished — a pin somebody has since
-- corrected is left exactly as they left it.
-- ------------------------------------------------------------
update public.map_places
   set latitude = null,
       longitude = null
 where category = 'rescue'
   and source like '%PIN NOT VERIFIED%'
   and is_verified is false
   and published is false;

-- ============================================================
-- ROLLBACK
--
-- Restoring NOT NULL FAILS if any row has a null coordinate, and
-- that failure is correct — it is telling you there is real data
-- the old shape cannot hold. Decide what those places should be
-- before forcing the constraint back:
--
--   select id, name, district from public.map_places
--    where latitude is null or longitude is null;
--
-- Then, once that list is empty or those rows have been dealt
-- with deliberately:
--
--   alter table public.map_places alter column latitude  set not null;
--   alter table public.map_places alter column longitude set not null;
--
-- The update above is not reversible — the placeholder district
-- coordinates it cleared were never real station locations, so
-- there is nothing worth restoring.
-- ============================================================
