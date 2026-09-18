-- ============================================================
-- phase125 — Skardu-area tourist spots.
--
-- REQUIRES phase124 (coordinates optional). Without it every
-- row below is rejected by NOT NULL.
--
-- ---------------------------------------------------------------------------
-- WHY ALL FOURTEEN ARRIVE WITHOUT COORDINATES
--
-- Fourteen places were supplied with names and categories and no
-- latitude or longitude. Approximate coordinates could be guessed
-- for most of them — and a guessed pin is indistinguishable, on a
-- map, from a confirmed one. Somebody driving to "Basho Meadows"
-- has no way to tell that the marker was an estimate.
--
-- So the names, the categories and the work queue are recorded,
-- and the positions are left blank for whoever confirms them. The
-- admin marks each one with the Edit button; the map draws it the
-- moment it has a position and is published.
--
-- Every row therefore ships:
--   * latitude and longitude NULL — cannot be drawn, enforced by
--     isLocated() rather than by anyone remembering
--   * published = false
--   * is_verified = false
--   * PIN NOT VERIFIED in source, which the admin list reads to
--     show an amber badge on the row and in the edit form
--
-- DISTRICT IS ALSO LEFT BLANK, ON PURPOSE
--   Most of these are in Skardu district and a few are not
--   clear-cut — Deosai spans more than one. Rather than assert a
--   district per row, each is filed to the region and the
--   district dropdown is left for someone who knows. It is two
--   clicks in the form and it will be right.
--
-- CATEGORIES
--   Mapped onto the slugs in MAP_CATEGORIES. Five of the supplied
--   categories had no equivalent, so waterfalls, valleys,
--   villages, deserts and heritage were added there in the same
--   change — otherwise a waterfall, a cold desert, a Buddha rock
--   and an organic village all become "Tourist Spots" and the
--   distinction supplied with them is thrown away.
--
-- SAFETY
--   Insert-only, guarded by name, so re-running it changes
--   nothing. No existing row is read, updated or deleted.
-- ============================================================

insert into public.map_places
  (name, category, region, district, city, latitude, longitude,
   description, status, is_verified, source, published)
select v.name, v.category, 'Gilgit-Baltistan', null::text, null::text,
       null::double precision, null::double precision,
       null::text, 'open', false,
       'PIN NOT VERIFIED — name and category supplied; coordinates still to be confirmed',
       false
from (values
  ('Deosai National Park',                  'parks'),
  ('Chunda Valley',                         'valleys'),
  ('Basho Valley (Basho Meadows)',          'valleys'),
  ('Nangsoq Organic Village',               'villages'),
  ('Satpara Lake',                          'lakes'),
  ('Katpana Cold Desert',                   'deserts'),
  ('Manthal Buddha Rock',                   'heritage'),
  ('Lower Kachura Lake (Shangrila Lake)',   'lakes'),
  ('Upper Kachura Lake',                    'lakes'),
  ('Kharphocho Fort',                       'forts'),
  ('Hussainabad Waterfall',                 'waterfalls'),
  ('Marsur Rock, Hussainabad',              'viewpoints'),
  ('Sok Valley',                            'valleys')
) as v(name, category)
where not exists (
  select 1 from public.map_places m where lower(m.name) = lower(v.name)
);

-- Supplied with an explicit "exact pin verify first" note, so it carries that
-- warning in its own description rather than only in this file.
insert into public.map_places
  (name, category, region, district, city, latitude, longitude,
   description, status, is_verified, source, published)
select 'Hargisa Scenic Streams', 'rivers', 'Gilgit-Baltistan', null, null,
       null::double precision, null::double precision,
       'Flagged on submission as needing its exact location verified before it goes on the map.',
       'open', false,
       'PIN NOT VERIFIED — submitted with an explicit instruction to verify the exact pin first',
       false
where not exists (
  select 1 from public.map_places m where lower(m.name) = lower('Hargisa Scenic Streams')
);

-- ============================================================
-- WHAT TO DO NEXT (in the admin: Rego Map → Pins)
--
--   All fourteen show an amber "Pin not verified" badge and read
--   "No coordinates — not shown on the map". For each: press
--   Edit, choose the District, fill in latitude and longitude,
--   add a photo and a description, delete the words PIN NOT
--   VERIFIED from Source, tick Verified, save, then Publish.
--
--   Nothing is public until that last step, so they can be worked
--   through a few at a time.
-- ============================================================

-- ============================================================
-- ROLLBACK
--
-- Removes only the fourteen rows this file added, by exact name,
-- and only while still untouched — a place somebody has since
-- located and verified is NOT deleted by an undo.
--
--   delete from public.map_places
--   where source like '%PIN NOT VERIFIED%'
--     and is_verified is false
--     and latitude is null
--     and name in (
--       'Deosai National Park', 'Chunda Valley',
--       'Basho Valley (Basho Meadows)', 'Nangsoq Organic Village',
--       'Satpara Lake', 'Katpana Cold Desert', 'Manthal Buddha Rock',
--       'Lower Kachura Lake (Shangrila Lake)', 'Upper Kachura Lake',
--       'Kharphocho Fort', 'Hussainabad Waterfall',
--       'Marsur Rock, Hussainabad', 'Sok Valley',
--       'Hargisa Scenic Streams'
--     );
--
-- The five categories added to MAP_CATEGORIES in src/lib/rego-map.ts
-- are code, not data — reverting them is a git revert, and should
-- only be done once no pin references those slugs.
-- ============================================================
