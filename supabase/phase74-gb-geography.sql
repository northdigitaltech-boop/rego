-- ============================================================================
-- Phase 74 — Real geography: divisions, all districts, and destinations as
--            AREAS under their correct district.
--
-- ADDITIVE AND IDEMPOTENT. Safe to re-run. Nothing becomes public.
--
-- ---------------------------------------------------------------------------
-- WHY THIS FILE EXISTS
--
-- phase72 seeded 9 districts directly under Gilgit-Baltistan. That was a
-- placeholder, and Report 7 proved it was not enough:
--
--   • GB has THREE DIVISIONS between the region and its districts.
--   • Several districts were missing (Kharmang, Roundu).
--   • Naran is NOT in Gilgit-Baltistan at all — it is in Mansehra district,
--     Khyber Pakhtunkhwa. Filing it under GB would be factually wrong and
--     would put its listings in the wrong market.
--   • Fairy Meadows is not a district. It is an area inside Diamer.
--
-- So: this file builds the real administrative tree, then places every
-- destination as an AREA under the district it actually sits in.
-- ---------------------------------------------------------------------------
--
-- ---------------------------------------------------------------------------
-- HONESTY ABOUT ACCURACY — READ THIS
--
-- District boundaries in Gilgit-Baltistan have changed repeatedly (Roundu and
-- Kharmang were carved out of Skardu; Nagar out of Gilgit). Some valleys sit
-- near a boundary, and at least one destination genuinely spans two districts.
--
-- Every mapping below therefore carries a confidence value:
--
--     'high'   — unambiguous, applied automatically
--     'review' — plausible but NOT certain, NOT applied; listed for you
--
-- I am not going to assert a district I am not sure of. A hotel filed under
-- the wrong district produces wrong search results, wrong SEO pages and wrong
-- area controls, and nobody notices for months.
-- ---------------------------------------------------------------------------
--
-- PREREQUISITE: phase72-market-areas.sql
-- ROLLBACK: bottom of file.
-- ============================================================================

do $$
begin
  if to_regclass('public.locations') is null then
    raise exception 'public.locations missing — run phase72-market-areas.sql first.';
  end if;
end $$;


-- ============================================================================
-- 1. HELPER — upsert a location, RE-PARENTING one that already exists
--    elsewhere in the same market at the same level.
--
-- ---------------------------------------------------------------------------
-- WHY THE RE-PARENT STEP EXISTS (this was a real bug, not a precaution)
--
-- The first version of this file looked a location up by (parent_id, slug)
-- only. phase72 had already created "Gilgit" directly under the region, so
-- looking for it under Gilgit Division found nothing and a SECOND "Gilgit"
-- was inserted. A later step then tried to move the original under the same
-- division and hit:
--
--     duplicate key value violates unique constraint
--     "locations_slug_sibling_uidx" ... (parent_id, gilgit) already exists
--
-- So the lookup now has two steps: exact position first, then "same slug and
-- same level anywhere in this market" — and if that is found, it is MOVED
-- rather than duplicated. Moving keeps the row's id, so anything already
-- pointing at it stays correct.
--
-- The location_type filter matters: "gilgit" exists as BOTH a district and
-- (later) an area beneath it. Without the filter, creating the district on a
-- re-run could grab the area and drag it up a level.
-- ---------------------------------------------------------------------------
-- ============================================================================
create or replace function public.upsert_location(
  p_market_id uuid,
  p_parent_id uuid,
  p_type      text,
  p_name      text,
  p_slug      text,
  p_lat       double precision default null,
  p_lng       double precision default null,
  p_order     int default 100
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  -- 1. Already in exactly the right place?
  if p_parent_id is null then
    select id into v_id from public.locations
     where market_id = p_market_id and slug = p_slug and parent_id is null;
  else
    select id into v_id from public.locations
     where market_id = p_market_id and slug = p_slug and parent_id = p_parent_id;
  end if;

  if v_id is not null then
    -- Only fill blanks. Never overwrite something an admin has since set.
    update public.locations
       set latitude      = coalesce(latitude, p_lat),
           longitude     = coalesce(longitude, p_lng),
           location_type = p_type
     where id = v_id;
    return v_id;
  end if;

  -- 2. Same slug, same level, wrong parent → move it instead of duplicating.
  select id into v_id from public.locations
   where market_id = p_market_id
     and slug = p_slug
     and location_type = p_type
     and parent_id is distinct from p_parent_id
   order by created_at
   limit 1;

  if v_id is not null then
    update public.locations
       set parent_id = p_parent_id,
           latitude  = coalesce(latitude, p_lat),
           longitude = coalesce(longitude, p_lng)
     where id = v_id;
    raise notice 're-parented existing % "%"', p_type, p_name;
    return v_id;
  end if;

  -- 3. Genuinely new.
  insert into public.locations
    (market_id, parent_id, location_type, name, slug, country_code,
     latitude, longitude, display_order)
  values
    (p_market_id, p_parent_id, p_type, p_name, p_slug, 'PK',
     p_lat, p_lng, p_order)
  returning id into v_id;

  return v_id;
end $$;


-- ============================================================================
-- 1b. CLEAN UP DUPLICATES LEFT BY A PARTIAL RUN
--
-- If the earlier version of this file got as far as creating districts under
-- the divisions before failing, this database may hold two rows for the same
-- district. Merge them: keep the oldest (the one phase72 created, which
-- anything else would already reference) and delete the empty newcomer.
--
-- Deletes ONLY rows that have no children and are referenced by nothing.
-- Anything with a dependency is reported and left alone.
-- ============================================================================
do $$
declare
  d record;
  n_removed int := 0;
begin
  for d in
    select market_id, slug, location_type, count(*) as n
      from public.locations
     group by market_id, slug, location_type
    having count(*) > 1
  loop
    -- Keep the oldest; delete newer twins that nothing depends on.
    with ranked as (
      select id, row_number() over (order by created_at) as rn
        from public.locations
       where market_id = d.market_id and slug = d.slug and location_type = d.location_type
    )
    delete from public.locations l
     using ranked r
     where l.id = r.id
       and r.rn > 1
       and not exists (select 1 from public.locations c where c.parent_id = l.id)
       and not exists (select 1 from public.destinations x where x.location_id = l.id);

    get diagnostics n_removed = row_count;
    if n_removed > 0 then
      raise notice 'merged % duplicate row(s) for % "%"', n_removed, d.location_type, d.slug;
    else
      raise warning 'duplicate % "%" could not be merged automatically — it has children or references. Resolve by hand.', d.location_type, d.slug;
    end if;
  end loop;
end $$;


-- ============================================================================
-- 2. BUILD THE TREE
--
--   Pakistan
--   ├── Gilgit-Baltistan
--   │   ├── Gilgit Division   → Gilgit, Ghizer, Hunza, Nagar
--   │   ├── Baltistan Division→ Skardu, Shigar, Kharmang, Ghanche, Roundu
--   │   └── Diamer Division   → Diamer, Astore
--   └── Khyber Pakhtunkhwa
--       └── Hazara Division   → Mansehra   (this is where Naran/Kaghan live)
-- ============================================================================
do $$
declare
  m_pk uuid;
  l_pk uuid;
  l_gb uuid; l_kp uuid;
  d_gil uuid; d_bal uuid; d_dia uuid; d_haz uuid;
begin
  select id into m_pk from public.markets where slug = 'pakistan';
  if m_pk is null then
    raise exception 'market "pakistan" missing — run phase72 first.';
  end if;

  select id into l_pk from public.locations
   where market_id = m_pk and slug = 'pakistan' and parent_id is null;

  /* ---- Provinces / regions ---- */
  l_gb := public.upsert_location(m_pk, l_pk, 'region', 'Gilgit-Baltistan',    'gilgit-baltistan',    35.8, 74.9, 1);
  l_kp := public.upsert_location(m_pk, l_pk, 'region', 'Khyber Pakhtunkhwa', 'khyber-pakhtunkhwa',  34.9, 72.3, 2);

  /* ---- Divisions ---- */
  d_gil := public.upsert_location(m_pk, l_gb, 'division', 'Gilgit Division',    'gilgit-division',    35.92, 74.31, 1);
  d_bal := public.upsert_location(m_pk, l_gb, 'division', 'Baltistan Division', 'baltistan-division', 35.30, 75.63, 2);
  d_dia := public.upsert_location(m_pk, l_gb, 'division', 'Diamer Division',    'diamer-division',    35.42, 74.10, 3);
  d_haz := public.upsert_location(m_pk, l_kp, 'division', 'Hazara Division',    'hazara-division',    34.40, 73.20, 1);

  /* ---- Districts: Gilgit Division ---- */
  perform public.upsert_location(m_pk, d_gil, 'district', 'Gilgit', 'gilgit', 35.9208, 74.3080, 1);
  perform public.upsert_location(m_pk, d_gil, 'district', 'Ghizer', 'ghizer', 36.1667, 73.7500, 2);
  perform public.upsert_location(m_pk, d_gil, 'district', 'Hunza',  'hunza',  36.3167, 74.6500, 3);
  perform public.upsert_location(m_pk, d_gil, 'district', 'Nagar',  'nagar',  36.2500, 74.7500, 4);

  /* ---- Districts: Baltistan Division ---- */
  perform public.upsert_location(m_pk, d_bal, 'district', 'Skardu',   'skardu',   35.2971, 75.6333, 1);
  perform public.upsert_location(m_pk, d_bal, 'district', 'Shigar',   'shigar',   35.4231, 75.7369, 2);
  perform public.upsert_location(m_pk, d_bal, 'district', 'Kharmang', 'kharmang', 35.1333, 76.0500, 3);
  perform public.upsert_location(m_pk, d_bal, 'district', 'Ghanche',  'ghanche',  35.1500, 76.3333, 4);
  perform public.upsert_location(m_pk, d_bal, 'district', 'Roundu',   'roundu',   35.5000, 74.9000, 5);

  /* ---- Districts: Diamer Division ---- */
  perform public.upsert_location(m_pk, d_dia, 'district', 'Diamer', 'diamer', 35.5333, 73.7500, 1);
  perform public.upsert_location(m_pk, d_dia, 'district', 'Astore', 'astore', 35.3667, 74.8583, 2);

  /* ---- Districts: Hazara Division (KP) ---- */
  perform public.upsert_location(m_pk, d_haz, 'district', 'Mansehra', 'mansehra', 34.3300, 73.2000, 1);

  raise notice 'Tree built: 2 regions, 4 divisions, 13 districts.';
end $$;


-- ============================================================================
-- 3. (removed)
--
-- This step used to move the phase72 districts under their new divisions in a
-- separate pass. That was the source of the duplicate-key failure: section 2
-- had already inserted a second copy of each district, so the move collided
-- with it.
--
-- upsert_location now re-parents an existing district in place, so the move
-- happens as part of building the tree and there is nothing left to do here.
-- The phase72 trigger rebuilds depth, ancestors and path_slugs for the whole
-- subtree automatically when a parent changes.
-- ============================================================================


-- ============================================================================
-- 4. THE PLACE → DISTRICT REFERENCE
--
-- One row per known place. `confidence = 'high'` is applied automatically;
-- `'review'` is reported and left for you.
--
-- match_norm is the NORMALISED text this place is known by — matched against
-- both destination names and the free-text location column on listings, so
-- one row here serves both.
-- ============================================================================
create table if not exists public.place_district_reference (
  id            uuid primary key default gen_random_uuid(),
  match_norm    text not null unique,
  place_name    text not null,
  district_slug text not null,
  confidence    text not null default 'high',
  note          text,
  created_at    timestamptz not null default now(),
  constraint pdr_confidence check (confidence in ('high','review'))
);

alter table public.place_district_reference enable row level security;
drop policy if exists pdr_read on public.place_district_reference;
create policy pdr_read on public.place_district_reference for select using (true);
drop policy if exists pdr_admin_write on public.place_district_reference;
create policy pdr_admin_write on public.place_district_reference
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.place_district_reference (match_norm, place_name, district_slug, confidence, note) values
  /* ---------- Skardu district ---------- */
  ('skardu',            'Skardu',             'skardu',   'high',  null),
  ('skardu city',       'Skardu City',        'skardu',   'high',  null),
  ('shangrila',         'Shangrila',          'skardu',   'high',  'Lower Kachura Lake'),
  ('lower kachura',     'Lower Kachura',      'skardu',   'high',  null),
  ('upper kachura',     'Upper Kachura',      'skardu',   'high',  null),
  ('satpara',           'Satpara',            'skardu',   'high',  null),
  ('sadpara',           'Sadpara',            'skardu',   'high',  'Alternate spelling of Satpara'),
  ('katpana',           'Katpana Cold Desert','skardu',   'high',  null),
  ('sarfaranga',        'Sarfaranga Desert',  'skardu',   'high',  null),
  ('shangrila resort',  'Shangrila Resort',   'skardu',   'high',  null),

  /* ---------- Shigar district ---------- */
  ('shigar',            'Shigar',             'shigar',   'high',  null),
  ('askole',            'Askole',             'shigar',   'high',  'Last village before Baltoro'),
  ('baltoro',           'Baltoro Glacier',    'shigar',   'high',  null),
  ('concordia',         'Concordia',          'shigar',   'high',  'K2 base camp approach'),
  ('k2 base camp',      'K2 Base Camp',       'shigar',   'high',  null),

  /* ---------- Ghanche district ---------- */
  ('khaplu',            'Khaplu',             'ghanche',  'high',  null),
  ('hushe',             'Hushe',              'ghanche',  'high',  null),
  ('machulu',           'Machulu',            'ghanche',  'high',  null),
  ('saling',            'Saling',             'ghanche',  'high',  null),

  /* ---------- Kharmang district ---------- */
  ('kharmang',          'Kharmang',           'kharmang', 'high',  null),
  ('manthokha',         'Manthokha Waterfall','kharmang', 'high',  null),

  /* ---------- Hunza district ---------- */
  ('hunza',             'Hunza',              'hunza',    'high',  null),
  ('hunza valley',      'Hunza Valley',       'hunza',    'high',  null),
  ('karimabad',         'Karimabad',          'hunza',    'high',  null),
  ('aliabad',           'Aliabad',            'hunza',    'high',  null),
  ('gulmit',            'Gulmit',             'hunza',    'high',  null),
  ('passu',             'Passu',              'hunza',    'high',  null),
  ('sost',              'Sost',               'hunza',    'high',  null),
  ('attabad',           'Attabad Lake',       'hunza',    'high',  null),
  ('attabad lake',      'Attabad Lake',       'hunza',    'high',  null),
  ('khunjerab',         'Khunjerab Pass',     'hunza',    'high',  null),
  ('gojal',             'Gojal',              'hunza',    'high',  'Upper Hunza'),
  ('altit',             'Altit',              'hunza',    'high',  null),
  ('baltit',            'Baltit',             'hunza',    'high',  null),
  ('duikar',            'Duikar',             'hunza',    'high',  'Eagle''s Nest viewpoint'),

  /* ---------- Nagar district ---------- */
  ('nagar',             'Nagar',              'nagar',    'high',  null),
  ('nagar valley',      'Nagar Valley',       'nagar',    'high',  null),
  ('hopper',            'Hopper Valley',      'nagar',    'high',  null),
  ('hoper',             'Hopper Valley',      'nagar',    'high',  null),
  ('minapin',           'Minapin',            'nagar',    'high',  null),
  ('rakaposhi base camp','Rakaposhi Base Camp','nagar',   'high',  null),

  /* ---------- Gilgit district ---------- */
  ('gilgit',            'Gilgit',             'gilgit',   'high',  null),
  ('gilgit city',       'Gilgit City',        'gilgit',   'high',  null),
  ('naltar',            'Naltar Valley',      'gilgit',   'high',  null),
  ('naltar valley',     'Naltar Valley',      'gilgit',   'high',  null),
  ('bagrote',           'Bagrote Valley',     'gilgit',   'high',  null),
  ('danyore',           'Danyore',            'gilgit',   'high',  null),
  ('juglot',            'Juglot',             'gilgit',   'high',  null),

  /* ---------- Ghizer district ---------- */
  ('ghizer',            'Ghizer',             'ghizer',   'high',  null),
  ('ghizer valley',     'Ghizer Valley',      'ghizer',   'high',  null),
  ('gahkuch',           'Gahkuch',            'ghizer',   'high',  null),
  ('phander',           'Phander Valley',     'ghizer',   'high',  null),
  ('phandar',           'Phander Valley',     'ghizer',   'high',  null),
  ('yasin',             'Yasin Valley',       'ghizer',   'high',  null),
  ('ishkoman',          'Ishkoman Valley',    'ghizer',   'high',  null),
  ('khalti',            'Khalti Lake',        'ghizer',   'high',  null),

  /* ---------- Astore district ---------- */
  ('astore',            'Astore',             'astore',   'high',  null),
  ('astore valley',     'Astore Valley',      'astore',   'high',  null),
  ('rama',              'Rama Meadow',        'astore',   'high',  null),
  ('rama lake',         'Rama Lake',          'astore',   'high',  null),
  ('rattu',             'Rattu',              'astore',   'high',  null),
  ('minimarg',          'Minimarg',           'astore',   'high',  null),
  ('domel',             'Domel',              'astore',   'high',  null),

  /* ---------- Diamer district ---------- */
  ('diamer',            'Diamer',             'diamer',   'high',  null),
  ('chilas',            'Chilas',             'diamer',   'high',  null),
  ('fairy meadows',     'Fairy Meadows',      'diamer',   'high',  'Raikot face of Nanga Parbat'),
  ('raikot',            'Raikot',             'diamer',   'high',  null),
  ('tato',              'Tato',               'diamer',   'high',  'Jeep track to Fairy Meadows'),
  ('nanga parbat',      'Nanga Parbat',       'diamer',   'high',  'Raikot/Fairy Meadows approach'),
  ('babusar',           'Babusar Top',        'diamer',   'review','Pass between Diamer and Mansehra (KP) — pick the side you sell'),

  /* ---------- Mansehra district, KP — NOT Gilgit-Baltistan ---------- */
  ('naran',             'Naran',              'mansehra', 'high',  'Kaghan Valley, KP — not GB'),
  ('naran valley',      'Naran Valley',       'mansehra', 'high',  null),
  ('kaghan',            'Kaghan',             'mansehra', 'high',  null),
  ('kaghan valley',     'Kaghan Valley',      'mansehra', 'high',  null),
  ('saif ul malook',    'Saif-ul-Malook Lake','mansehra', 'high',  null),
  ('saiful malook',     'Saif-ul-Malook Lake','mansehra', 'high',  null),
  ('lulusar',           'Lulusar Lake',       'mansehra', 'high',  null),
  ('shogran',           'Shogran',            'mansehra', 'high',  null),
  ('siri paye',         'Siri Paye',          'mansehra', 'high',  null),
  ('balakot',           'Balakot',            'mansehra', 'high',  null),

  /* ---------- Needs your decision ---------- */
  ('deosai',            'Deosai Plains',      'skardu',   'review','Deosai spans Skardu AND Astore. Filed under Skardu because that is the usual approach — change it if you sell it from Astore.'),
  ('deosai plains',     'Deosai Plains',      'skardu',   'review','Same as above.'),
  ('sheosar',           'Sheosar Lake',       'astore',   'review','Sheosar sits on the Astore side of Deosai.'),
  ('bilamik',           'Bilamik Valley',     'roundu',   'review','Roundu was carved out of Skardu. Confirm which district Bilamik now falls in.'),
  ('bilamik valley',    'Bilamik Valley',     'roundu',   'review','Same as above.'),
  ('basho',             'Basho Valley',       'roundu',   'review','Basho/Bashho is near the Skardu-Roundu boundary. Confirm.'),
  ('bashho',            'Basho Valley',       'roundu',   'review','Same as above.'),
  ('sultanabad',        'Sultanabad',         'skardu',   'review','Several places in GB are called Sultanabad. Confirm which one you mean.'),
  ('shandur',           'Shandur Pass',       'ghizer',   'review','Shandur sits on the Ghizer / Chitral (KP) boundary.')
on conflict (match_norm) do nothing;


-- ============================================================================
-- 5. CREATE AN AREA FOR EVERY DESTINATION, UNDER ITS DISTRICT
--
-- Rule, exactly as requested: every destination becomes an `area` under the
-- district it actually sits in.
--
-- Two things this deliberately does NOT do:
--
--   1. It does not touch destinations.slug. Those are live indexed URLs
--      (/destinations/hunza-valley). The area gets its own slug in the tree;
--      the public URL is unchanged.
--   2. It does not apply 'review' mappings. Those are printed for you.
--
-- A destination whose name IS a district (e.g. "Gilgit") still gets an area
-- row, so that a listing can say "Gilgit city centre" separately from the
-- district as a whole. That keeps the levels honest.
-- ============================================================================
do $$
declare
  r record;
  m_pk uuid;
  v_district_slug text;
  v_confidence    text;
  v_district_id   uuid;
  v_area uuid;
  n_linked int := 0;
  n_review int := 0;
  n_none   int := 0;
begin
  select id into m_pk from public.markets where slug = 'pakistan';

  for r in
    select d.id, d.slug, d.name,
           public.norm_location_text(d.name) as norm_name,
           public.norm_location_text(d.slug) as norm_slug
      from public.destinations d
     order by d.slug
  loop
    /* Fresh locals each iteration — a stale value from the previous row would
       silently file this destination in the wrong district. */
    v_district_slug := null;
    v_confidence    := null;
    v_district_id   := null;

    -- Longest match wins: "hunza valley" should beat "hunza".
    select p.district_slug, p.confidence
      into v_district_slug, v_confidence
      from public.place_district_reference p
     where p.match_norm in (r.norm_name, r.norm_slug)
        or r.norm_name ~ ('(^| )' || p.match_norm || '( |$)')
        or r.norm_slug ~ ('(^| )' || p.match_norm || '( |$)')
     order by (p.match_norm in (r.norm_name, r.norm_slug)) desc,
              length(p.match_norm) desc
     limit 1;

    if v_district_slug is null then
      raise notice 'NO MAPPING: destination "%" (%) — add a row to place_district_reference', r.name, r.slug;
      n_none := n_none + 1;
      continue;
    end if;

    if v_confidence = 'review' then
      raise notice 'NEEDS REVIEW: destination "%" -> % (not applied)', r.name, v_district_slug;
      n_review := n_review + 1;
      continue;
    end if;

    -- Resolve the district row itself.
    select id into v_district_id
      from public.locations
     where market_id = m_pk and slug = v_district_slug and location_type = 'district';

    if v_district_id is null then
      raise notice 'district row "%" missing for destination "%"', v_district_slug, r.name;
      n_none := n_none + 1;
      continue;
    end if;

    v_area := public.upsert_location(m_pk, v_district_id, 'area', r.name, r.slug);

    -- Link the destination row to its area. This column was added by phase72
    -- and is NULL for every row until now.
    update public.destinations
       set location_id = v_area,
           market_id   = m_pk
     where id = r.id and location_id is null;

    n_linked := n_linked + 1;
  end loop;

  raise notice '--------------------------------------------';
  raise notice 'linked  : %  destinations placed under a district', n_linked;
  raise notice 'review  : %  need your decision (see notices above)', n_review;
  raise notice 'no map  : %  have no reference row yet', n_none;
  raise notice '--------------------------------------------';
end $$;


-- ============================================================================
-- 6. REPORTS
-- ============================================================================

-- 6a. The tree as built. Read this first.
select
  repeat('    ', depth) || name as tree,
  location_type,
  slug,
  depth
from public.locations
order by path_slugs;

-- 6b. Destinations still unplaced — these need a reference row or a decision.
select
  d.slug as destination_slug,
  d.name as destination_name,
  d.location as free_text_location,
  coalesce(p.confidence, 'no-reference-row') as why
from public.destinations d
left join public.place_district_reference p
       on p.match_norm = public.norm_location_text(d.name)
       or p.match_norm = public.norm_location_text(d.slug)
where d.location_id is null
order by d.slug;

-- 6c. Everything I was NOT confident about. Decide these yourself.
select match_norm, place_name, district_slug, note
from public.place_district_reference
where confidence = 'review'
order by place_name;

-- 6d. Confirm nothing went public.
select count(*) as public_locations from public.locations where is_public is true;


-- ============================================================================
-- HOW TO RESOLVE A 'review' ROW
--
-- Confirm the district, then flip it to high and re-run section 5 by
-- re-running this whole file (it is idempotent):
--
--   update public.place_district_reference
--      set district_slug = 'astore', confidence = 'high',
--          note = 'confirmed: we sell Deosai from the Astore side'
--    where match_norm = 'deosai';
--
-- To add a place I did not list:
--
--   insert into public.place_district_reference
--     (match_norm, place_name, district_slug, confidence)
--   values ('gulkin', 'Gulkin', 'hunza', 'high');
-- ============================================================================


-- ============================================================================
-- ROLLBACK
--
-- Unlinks destinations, removes the areas created here, moves districts back
-- under the region, and drops the divisions and the KP branch.
-- Districts themselves are left in place — phase72 created them.
-- ============================================================================
/*
do $$
declare
  m_pk uuid; l_gb uuid;
begin
  select id into m_pk from public.markets where slug = 'pakistan';
  select id into l_gb from public.locations where market_id = m_pk and slug = 'gilgit-baltistan';

  -- 1. unlink destinations
  update public.destinations set location_id = null, market_id = null;

  -- 2. delete areas created by this file
  delete from public.locations where location_type = 'area' and market_id = m_pk;

  -- 3. districts back under the region
  update public.locations set parent_id = l_gb
   where location_type = 'district'
     and parent_id in (select id from public.locations where location_type = 'division');

  -- 4. drop divisions and the KP branch
  delete from public.locations where location_type = 'division';
  delete from public.locations where slug = 'khyber-pakhtunkhwa';

  -- 5. districts added by this file (phase72 did not create these)
  delete from public.locations where slug in ('kharmang','roundu','mansehra');
end $$;

drop table    if exists public.place_district_reference;
drop function if exists public.upsert_location(uuid, uuid, text, text, text, double precision, double precision, int);
*/
