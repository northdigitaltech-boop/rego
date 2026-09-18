-- ============================================================
-- phase122 — record which region a map pin is in.
--
-- WHAT THIS DOES
--   Adds one nullable text column to public.map_places.
--
-- WHY A COLUMN AND NOT A FOREIGN KEY TO locations
--   district and city on this table are already text, and a
--   hundred-odd rows are filled in that way. Making region a
--   uuid would mean this one field behaves differently from the
--   two beside it, and every read — the explorer, the dashboard
--   popup, the admin search box — would need a join it does not
--   need today. The picker writes names taken straight from the
--   locations tree, so the strings match by construction rather
--   than by hope.
--
-- SAFETY
--   Additive and nullable. Nothing is dropped, nothing is
--   rewritten, no existing row changes, and every existing query
--   keeps working untouched — `select *` simply returns one more
--   column that is null everywhere until someone edits a pin.
--
--   No backfill. The region could be derived from the district
--   for most rows, but a guess written into a data column is
--   indistinguishable from something a person confirmed, and
--   these rows drive a map people use to decide whether a road
--   is passable. The picker fills it in the first time each pin
--   is opened and saved.
-- ============================================================

alter table public.map_places
  add column if not exists region text;

comment on column public.map_places.region is
  'Region / province name, chosen from public.locations by the admin map form. Null on pins created before phase122.';

-- Pins are filtered by area on the public map; district is already indexed
-- (phase45), and region is the level above it.
create index if not exists map_places_region_idx
  on public.map_places (region);

-- ============================================================
-- ROLLBACK
--
-- Safe to run: the column is new in this phase, so dropping it
-- cannot destroy anything that existed before it. Any region
-- values captured since are lost, which is the intended cost of
-- an undo — district and city are untouched either way.
--
--   drop index if exists public.map_places_region_idx;
--   alter table public.map_places drop column if exists region;
-- ============================================================
