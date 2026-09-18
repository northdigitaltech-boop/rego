-- ============================================================
-- phase127 — the same Shigar spots on the destination page.
--
-- destinations.attractions is a JSONB array of
-- { name, type, blurb, image } (phase65). This adds the Shigar
-- spots to it.
--
-- ---------------------------------------------------------------------------
-- APPEND ONLY — IT NEVER OVERWRITES THE ARRAY
--
-- The obvious way to do this is to set `attractions` to the new
-- list. That would silently destroy whatever the admin has
-- already done: the four entries that were there before, any
-- wording they rewrote, and every photo they uploaded — because
-- `image` lives on the attraction, not on the destination.
--
-- So each spot is added only if no entry with that name (case-
-- insensitively) already exists. Running this on a destination
-- that already has "Shigar Fort (Fong Khar)" with a photo leaves
-- that entry exactly as it is and adds the rest around it.
--
-- That also makes the file re-runnable: a second run finds every
-- name present and changes nothing.
--
-- MATCHING THE DESTINATION
--   By slug 'shigar', or by name, because destinations are
--   created in the admin and the slug is derived from whatever
--   was typed. If no Shigar destination exists the statement
--   simply affects no rows — it does not create one, because a
--   destination carries a cover image, an intro and SEO fields
--   that are not this file's to invent.
--
-- SAFETY
--   One UPDATE, scoped to the Shigar row(s), append-only.
-- ============================================================

with wanted (name, type, blurb) as (
  values
    ('Shigar Valley',                 'Valley',    'The valley between Skardu and the Baltoro — orchards, terraces and old Balti villages.'),
    ('Shigar Fort (Fong Khar)',       'Fort',      'A restored palace that now works as a heritage hotel.'),
    ('Amburiq Mosque',                'Heritage',  'A 14th-century carved wooden mosque.'),
    ('Sarfaranga Cold Desert',        'Desert',    'Sand flats on the Shigar river beneath snow peaks, and home of the jeep rally.'),
    ('Blind Lake (Zharba Tso)',       'Lake',      'A hidden lake reached by a short walk.'),
    ('Askole Village',                'Valley',    'The last village before K2 and the Baltoro Glacier, and where the jeep road ends.'),
    ('Braldu Valley',                 'Valley',    'The valley beyond Askole that carries the route in towards the Baltoro.'),
    ('Baltoro Glacier',               'Glacier',   'One of the longest glaciers outside the polar regions, and the way in to the 8,000m peaks.'),
    ('Paiju Camp',                    'Trek',      'The campsite at the snout of the Baltoro, where the glacier walk begins.'),
    ('Urdukas',                       'Viewpoint', 'A camp on the rock terraces above the glacier, facing the Trango Towers.'),
    ('Goro (Baltoro trekking area)',  'Trek',      'Camps out on the open ice between Urdukas and Concordia.'),
    ('Concordia',                     'Viewpoint', 'Where the Baltoro and Godwin-Austen glaciers meet, ringed by four 8,000m peaks.'),
    ('K2',                            'Mountain',  'At 8,611m, the second-highest mountain on earth.'),
    ('K2 Base Camp',                  'Trek',      'The foot of K2, at the head of the Godwin-Austen glacier.'),
    ('Broad Peak',                    'Mountain',  '8,051m, standing beside K2 above Concordia.'),
    ('Broad Peak Base Camp',          'Trek',      'Camp at the foot of Broad Peak, on the Godwin-Austen glacier.'),
    ('Gasherbrum I',                  'Mountain',  '8,080m, also known as Hidden Peak.'),
    ('Gasherbrum II',                 'Mountain',  '8,035m, on the Pakistan–China frontier.')
),
target as (
  select id, attractions
    from public.destinations
   where slug = 'shigar' or lower(name) = 'shigar'
),
additions as (
  select t.id,
         coalesce(
           jsonb_agg(
             jsonb_build_object(
               'name',  w.name,
               'type',  w.type,
               'blurb', w.blurb,
               -- Left empty on purpose: the page falls back to the
               -- destination cover, and an invented image URL would render
               -- as a broken picture on a live page.
               'image', ''
             )
             order by w.ord
           ) filter (where w.name is not null),
           '[]'::jsonb
         ) as extra
    from target t
    left join (select *, row_number() over () as ord from wanted) w
      on not exists (
           select 1
             from jsonb_array_elements(t.attractions) e
            where lower(e ->> 'name') = lower(w.name)
         )
   group by t.id
)
update public.destinations d
   set attractions = d.attractions || a.extra
  from additions a
 where d.id = a.id
   and jsonb_array_length(a.extra) > 0;

-- ============================================================
-- CHECK IT LANDED
--
--   select name,
--          jsonb_array_length(attractions) as attractions
--     from public.destinations
--    where slug = 'shigar' or lower(name) = 'shigar';
--
-- No rows back means there is no Shigar destination yet. Create
-- it in the admin (Destinations → Add), then run this file again.
-- ============================================================

-- ============================================================
-- ROLLBACK
--
-- Removes only the entries this file adds, and only the ones
-- still untouched — anything given a photo or reworded since is
-- kept, because `image = ''` no longer holds for it.
--
--   update public.destinations d
--      set attractions = coalesce((
--            select jsonb_agg(e)
--              from jsonb_array_elements(d.attractions) e
--             where not (
--               e ->> 'image' = ''
--               and e ->> 'name' in (
--                 'Shigar Valley', 'Sarfaranga Cold Desert',
--                 'Blind Lake (Zharba Tso)', 'Askole Village',
--                 'Braldu Valley', 'Baltoro Glacier', 'Paiju Camp',
--                 'Urdukas', 'Goro (Baltoro trekking area)', 'Concordia',
--                 'K2', 'K2 Base Camp', 'Broad Peak',
--                 'Broad Peak Base Camp', 'Gasherbrum I', 'Gasherbrum II'
--               )
--             )
--          ), '[]'::jsonb)
--    where d.slug = 'shigar' or lower(d.name) = 'shigar';
--
-- 'Shigar Fort (Fong Khar)' and 'Amburiq Mosque' are deliberately
-- absent from that list: they existed before this file ran, so an
-- undo must not take them.
-- ============================================================
