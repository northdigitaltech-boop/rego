-- ============================================================
-- phase126 — Shigar district tourist spots, for the map.
--
-- REQUIRES phase124 (coordinates optional).
--
-- Same shape as phase125: eighteen places supplied with names
-- and categories and no coordinates, so none of them is given a
-- position and none is published. A guessed pin reads exactly
-- like a confirmed one once it is on a map — and on the Baltoro
-- that matters more than anywhere else in the province, because
-- the people reading it are days from a road.
--
-- Every row ships with latitude and longitude NULL, published
-- false, is_verified false, and PIN NOT VERIFIED in source, which
-- the admin list turns into an amber badge.
--
-- DISTRICT IS SET HERE, UNLIKE phase125
--   These were supplied as Shigar district spots, so the district
--   is recorded rather than guessed. Region is Gilgit-Baltistan.
--
-- CATEGORIES
--   peaks, glaciers and base-camps were added to MAP_CATEGORIES
--   in src/lib/rego-map.ts in the same change. Without them K2,
--   the Baltoro and Concordia would all be filed as "Trekking
--   Routes", which is true of none of them.
--
-- SAFETY
--   Insert-only, guarded by name, re-runnable. No existing row is
--   read, updated or deleted.
-- ============================================================

insert into public.map_places
  (name, category, region, district, city, latitude, longitude,
   description, status, is_verified, source, published)
select v.name, v.category, 'Gilgit-Baltistan', 'Shigar', null::text,
       null::double precision, null::double precision,
       null::text, 'open', false,
       'PIN NOT VERIFIED — name and category supplied; coordinates still to be confirmed',
       false
from (values
  ('Shigar Valley',              'valleys'),
  ('Shigar Fort (Fong Khar)',    'forts'),
  ('Amburiq Mosque',             'mosques'),
  ('Sarfaranga Cold Desert',     'deserts'),
  ('Blind Lake (Zharba Tso)',    'lakes'),
  ('Askole Village',             'villages'),
  ('Braldu Valley',              'valleys'),
  ('Baltoro Glacier',            'glaciers'),
  ('K2',                         'peaks'),
  ('K2 Base Camp',               'base-camps'),
  ('Concordia',                  'viewpoints'),
  ('Broad Peak',                 'peaks'),
  ('Broad Peak Base Camp',       'base-camps'),
  ('Gasherbrum I',               'peaks'),
  ('Gasherbrum II',              'peaks'),
  ('Paiju Camp',                 'base-camps'),
  ('Urdukas',                    'base-camps'),
  ('Goro (Baltoro trekking area)', 'base-camps')
) as v(name, category)
where not exists (
  select 1 from public.map_places m where lower(m.name) = lower(v.name)
);

-- ============================================================
-- WHAT TO DO NEXT (in the admin: Rego Map → Pins)
--
--   All eighteen show an amber "Pin not verified" badge. For
--   each: press Edit, fill in latitude and longitude, add a
--   photo and a description, delete the words PIN NOT VERIFIED
--   from Source, tick Verified, save, then Publish.
--
--   The high-altitude ones are worth doing carefully or leaving
--   unpublished. A base camp marker a few kilometres out is not
--   a cosmetic error at 5,000m.
-- ============================================================

-- ============================================================
-- ROLLBACK
--
-- Only the rows this file added, by exact name, and only while
-- still untouched — anything since located and verified stays.
--
--   delete from public.map_places
--   where source like '%PIN NOT VERIFIED%'
--     and is_verified is false
--     and latitude is null
--     and district = 'Shigar'
--     and name in (
--       'Shigar Valley', 'Shigar Fort (Fong Khar)', 'Amburiq Mosque',
--       'Sarfaranga Cold Desert', 'Blind Lake (Zharba Tso)',
--       'Askole Village', 'Braldu Valley', 'Baltoro Glacier', 'K2',
--       'K2 Base Camp', 'Concordia', 'Broad Peak',
--       'Broad Peak Base Camp', 'Gasherbrum I', 'Gasherbrum II',
--       'Paiju Camp', 'Urdukas', 'Goro (Baltoro trekking area)'
--     );
-- ============================================================
