-- ============================================================================
-- Phase 77 — Resolve the places phase74 was not confident about
--
-- ADDITIVE AND IDEMPOTENT. Safe to re-run. Nothing becomes public.
--
-- ---------------------------------------------------------------------------
-- THESE ARE YOUR DECISIONS, NOT MY GUESSES
--
-- phase74 flagged nine places I would not assert a district for. All are now
-- decided by you and recorded here:
--
--   Bilamik      -> Roundu    (Roundu district, which sits under Baltistan)
--   Basho        -> Skardu    ) same place, two names — see below
--   Sultanabad   -> Skardu    )
--   Sheosar      -> Skardu    (inside Deosai)
--   Deosai       -> Skardu
--   Shandur      -> Chitral   (KP, not Ghizer)
--   Babusar      -> Diamer    (the GB side of the pass)
--
-- Nothing is left as 'review'.
--
-- NOTE ON BILAMIK: an earlier draft of this file put Bilamik under Skardu,
-- because "Bilamik Roundu Skardu mein aata hai" reads two ways — Bilamik is
-- in Roundu, or Bilamik is in Skardu. It is the former: Roundu is its own
-- district, and Bilamik belongs to it. Corrected below. phase74's original
-- guess was right and my first correction was wrong.
-- ---------------------------------------------------------------------------
--
-- PREREQUISITE: phase74-gb-geography.sql
-- ROLLBACK: bottom of file.
-- ============================================================================

do $$
begin
  if to_regclass('public.place_district_reference') is null then
    raise exception 'run phase74-gb-geography.sql first.';
  end if;
end $$;


-- ============================================================================
-- 1. CHITRAL — a district the tree did not have
--
-- Shandur belongs to Chitral, and Chitral is in Khyber Pakhtunkhwa's Malakand
-- Division, not in Gilgit-Baltistan. phase74 built the KP branch only as far
-- as Hazara Division (for Naran), so Malakand and Chitral are added here.
--
-- Chitral was split into Upper and Lower Chitral districts in 2018. A single
-- "Chitral" node is used because Shandur sits at the far upper end and the
-- split does not change anything you sell today — add the two sub-districts
-- from the admin later if it ever matters.
-- ============================================================================
do $$
declare
  m_pk uuid; l_kp uuid; d_mal uuid;
begin
  select id into m_pk from public.markets where slug = 'pakistan';
  if m_pk is null then
    raise exception 'market "pakistan" missing — run phase72 first.';
  end if;

  select id into l_kp from public.locations
   where market_id = m_pk and slug = 'khyber-pakhtunkhwa';
  if l_kp is null then
    raise exception 'Khyber Pakhtunkhwa missing — run phase74 first.';
  end if;

  d_mal := public.upsert_location(m_pk, l_kp, 'division', 'Malakand Division', 'malakand-division', 35.20, 71.80, 2);
  perform public.upsert_location(m_pk, d_mal, 'district', 'Chitral', 'chitral', 35.8518, 71.7864, 1);

  raise notice 'Added Malakand Division and Chitral district (KP).';
end $$;


-- ============================================================================
-- 2. RECORD THE DECISIONS
--
-- Each row moves from 'review' to 'high' with the district you gave, and the
-- note records that a human decided it. When somebody reads this table in a
-- year, "confirmed by owner" is the difference between a fact and a guess
-- that nobody re-checked.
-- ============================================================================

/* ---- Bilamik → Roundu ----
   Roundu is its own district under Baltistan Division, and Bilamik belongs
   to it. The Roundu node phase74 created is therefore used, not orphaned. */
update public.place_district_reference
   set district_slug = 'roundu', confidence = 'high',
       place_name    = 'Bilamik Valley',
       note          = 'Confirmed by owner: Bilamik is in Roundu district.'
 where match_norm in ('bilamik', 'bilamik valley', 'bilamic');

/* ---- Babusar → Diamer ----
   The pass straddles Diamer (GB) and Mansehra (KP); you sell the GB side. */
update public.place_district_reference
   set district_slug = 'diamer', confidence = 'high',
       place_name    = 'Babusar Top',
       note          = 'Confirmed by owner: the Diamer (GB) side of the pass.'
 where match_norm in ('babusar', 'babusar top', 'babusar pass');

/* ---- Basho and Sultanabad → Skardu, and they are ONE place ----
   You said these are two names for the same place. So both must resolve to
   the SAME area, otherwise a hotel typed as "Sultanabad" and one typed as
   "Basho" end up on two different pages competing with each other.
   "Basho Valley" is used as the canonical name; both spellings point to it.
   To flip the canonical name, change place_name on all four rows below. */
update public.place_district_reference
   set district_slug = 'skardu', confidence = 'high',
       place_name    = 'Basho Valley',
       note          = 'Confirmed by owner: Basho and Sultanabad are the same place, in Skardu.'
 where match_norm in ('basho', 'bashho', 'sultanabad');

/* ---- Sheosar → Skardu ---- */
update public.place_district_reference
   set district_slug = 'skardu', confidence = 'high',
       place_name    = 'Sheosar Lake',
       note          = 'Confirmed by owner: Sheosar is in Deosai, sold as Skardu.'
 where match_norm = 'sheosar';

/* ---- Deosai → Skardu ----
   phase74 flagged this because Deosai physically spans Skardu and Astore.
   You sell it from Skardu, so the ambiguity is resolved commercially. */
update public.place_district_reference
   set district_slug = 'skardu', confidence = 'high',
       place_name    = 'Deosai Plains',
       note          = 'Confirmed by owner: sold from the Skardu side.'
 where match_norm in ('deosai', 'deosai plains');

/* ---- Shandur → Chitral, not Ghizer ---- */
update public.place_district_reference
   set district_slug = 'chitral', confidence = 'high',
       place_name    = 'Shandur Pass',
       note          = 'Confirmed by owner: Shandur is in Chitral (KP).'
 where match_norm in ('shandur', 'shandoor');

-- 'shandoor' may not exist yet — the common alternate spelling.
insert into public.place_district_reference (match_norm, place_name, district_slug, confidence, note)
values ('shandoor', 'Shandur Pass', 'chitral', 'high', 'Alternate spelling.')
on conflict (match_norm) do nothing;

/* ---- Extra spellings that will otherwise land as UNMATCHED ---- */
insert into public.place_district_reference (match_norm, place_name, district_slug, confidence, note) values
  ('basho valley',      'Basho Valley',   'skardu',  'high', 'Same place as Sultanabad.'),
  ('bashho valley',     'Basho Valley',   'skardu',  'high', 'Alternate spelling.'),
  ('sultan abad',       'Basho Valley',   'skardu',  'high', 'Alternate spelling of Sultanabad.'),
  ('sheosar lake',      'Sheosar Lake',   'skardu',  'high', null),
  ('shausar',           'Sheosar Lake',   'skardu',  'high', 'Alternate spelling.'),
  ('deosai national park','Deosai Plains','skardu',  'high', null),
  ('bilamic',           'Bilamik Valley', 'roundu',  'high', 'Alternate spelling.'),
  ('babusar top',       'Babusar Top',    'diamer',  'high', null),
  ('babusar pass',      'Babusar Top',    'diamer',  'high', 'Alternate name.'),
  ('roundu',            'Roundu',         'roundu',  'high', null),
  ('rondu',             'Roundu',         'roundu',  'high', 'Alternate spelling.')
on conflict (match_norm) do nothing;


-- ============================================================================
-- 3. CREATE THE AREAS
--
-- phase74 only creates areas from rows in public.destinations. These places
-- may not be destinations yet, so create them directly — otherwise the
-- decisions above resolve to the district and lose the detail.
-- ============================================================================
do $$
declare
  m_pk uuid;
  d_skardu uuid;
  d_roundu uuid;
  d_diamer uuid;
  d_chitral uuid;
begin
  select id into m_pk from public.markets where slug = 'pakistan';
  select id into d_skardu  from public.locations where market_id = m_pk and slug = 'skardu'  and location_type = 'district';
  select id into d_roundu  from public.locations where market_id = m_pk and slug = 'roundu'  and location_type = 'district';
  select id into d_diamer  from public.locations where market_id = m_pk and slug = 'diamer'  and location_type = 'district';
  select id into d_chitral from public.locations where market_id = m_pk and slug = 'chitral' and location_type = 'district';

  if d_skardu is null then
    raise exception 'Skardu district missing — run phase74 first.';
  end if;

  perform public.upsert_location(m_pk, d_skardu, 'area', 'Deosai Plains', 'deosai',       34.9833, 75.4167, 10);
  perform public.upsert_location(m_pk, d_skardu, 'area', 'Sheosar Lake',  'sheosar-lake', 34.8500, 75.1000, 11);
  perform public.upsert_location(m_pk, d_skardu, 'area', 'Basho Valley',  'basho-valley', 35.4167, 75.1667, 12);

  /* Bilamik sits under Roundu, not Skardu. If an earlier run of this file
     created it under Skardu, upsert_location re-parents it rather than
     making a second copy — same id, so nothing pointing at it breaks. */
  if d_roundu is not null then
    perform public.upsert_location(m_pk, d_roundu, 'area', 'Bilamik Valley', 'bilamik-valley', 35.5000, 75.0000, 1);
  else
    raise warning 'Roundu district missing — Bilamik not created. Run phase74.';
  end if;

  if d_diamer is not null then
    perform public.upsert_location(m_pk, d_diamer, 'area', 'Babusar Top', 'babusar-top', 35.1500, 74.0333, 5);
  end if;

  if d_chitral is not null then
    perform public.upsert_location(m_pk, d_chitral, 'area', 'Shandur Pass', 'shandur-pass', 36.0833, 72.5500, 1);
  end if;

  raise notice 'Areas: Skardu (3), Roundu (1), Diamer (1), Chitral (1).';
end $$;


-- ============================================================================
-- 4. LINK ANY MATCHING DESTINATION ROWS
--
-- If any of these already exist in public.destinations, attach them to the
-- area just created. Rows that already have a location_id are left alone —
-- an existing link may have been set deliberately.
-- ============================================================================
do $$
declare
  r record;
  m_pk uuid;
  v_area uuid;
  n int := 0;
begin
  select id into m_pk from public.markets where slug = 'pakistan';

  for r in
    select d.id, d.name, public.norm_location_text(d.name) as norm
      from public.destinations d
     where d.location_id is null
  loop
    select coalesce(area.id, dist.id) into v_area
      from public.place_district_reference p
      join public.locations dist
        on dist.slug = p.district_slug and dist.location_type = 'district'
      left join public.locations area
        on area.parent_id = dist.id
       and public.norm_location_text(area.name) = public.norm_location_text(p.place_name)
     where p.match_norm = r.norm
       and p.confidence = 'high'
     limit 1;

    if v_area is not null then
      update public.destinations
         set location_id = v_area, market_id = m_pk
       where id = r.id;
      n := n + 1;
      raise notice 'linked destination "%"', r.name;
    end if;
  end loop;

  raise notice 'Newly linked destinations: %', n;
end $$;


-- ============================================================================
-- 5. REPORTS
-- ============================================================================

-- 5a. What is still undecided. Should now be EMPTY.
select match_norm, place_name, district_slug, note
from public.place_district_reference
where confidence = 'review'
order by place_name;

-- 5b. The branches this file touched, to eyeball the result.
select repeat('    ', depth) || name as tree, location_type, slug
from public.locations
where slug in ('skardu','roundu','diamer','chitral')
   or id in (
     select l.id from public.locations l
      join public.locations p on p.id = l.parent_id
     where p.slug in ('skardu','roundu','diamer','chitral')
   )
order by path_slugs;

-- 5c. Destinations still without an area.
select slug, name, location as free_text
from public.destinations
where location_id is null
order by slug;

-- 5d. Nothing should be public yet.
select count(*) as public_locations from public.locations where is_public is true;


-- ============================================================================
-- AFTER THIS FILE
--
-- Re-run phase74 and phase75 — both are idempotent — so that the newly
-- decided places pick up any destinations and listings that mention them:
--
--   1. phase74-gb-geography.sql        (links destinations to the new areas)
--   2. phase75-listings-backfill.sql   (dry run first, then apply)
--
-- Report 5a in this file should come back EMPTY. If anything is still
-- 'review', it is a place I flagged that you have not ruled on yet.
-- ============================================================================


-- ============================================================================
-- ROLLBACK
-- ============================================================================
/*
-- Areas created here (only if nothing hangs off them).
delete from public.locations
 where slug in ('deosai','sheosar-lake','basho-valley','bilamik-valley',
                'babusar-top','shandur-pass')
   and location_type = 'area';

-- Chitral branch.
delete from public.locations where slug = 'chitral'  and location_type = 'district';
delete from public.locations where slug = 'malakand-division';

-- Put the decisions back to unresolved.
update public.place_district_reference
   set confidence = 'review'
 where match_norm in ('bilamik','bilamik valley','basho','bashho','sultanabad',
                      'sheosar','deosai','deosai plains','shandur','babusar');

delete from public.place_district_reference
 where match_norm in ('shandoor','basho valley','bashho valley','sultan abad',
                      'sheosar lake','shausar','deosai national park','bilamic',
                      'babusar top','babusar pass','roundu','rondu');
*/
