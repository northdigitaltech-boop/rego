-- ============================================================================
-- Phase 83 — GeoNames reference table
--
-- ADDITIVE AND IDEMPOTENT. Creates one lookup table. Touches nothing existing.
--
-- ---------------------------------------------------------------------------
-- THIS IS A LOOKUP, NOT THE LOCATION TREE.
--
-- public.locations stays the authoritative Rego tree — the places Rego
-- actually operates in, with their availability, SEO and answers.
--
-- public.geo_reference is a dictionary you search when ADDING one. Picking a
-- row here copies its name, coordinates and suggested level into a new
-- locations row; the reference row itself is never rendered, never governed
-- and never appears on the site.
--
-- Keeping them separate matters. GeoNames has millions of places worldwide
-- and Pakistan alone has tens of thousands. Importing those into `locations`
-- would bury the two hundred places Rego cares about under thousands with no
-- listings, no answers and no reason to exist.
-- ---------------------------------------------------------------------------
--
-- SOURCE: GeoNames (https://www.geonames.org), CC BY 4.0.
-- Attribution is a licence condition — see the note at the bottom.
--
-- ROLLBACK: bottom of file.
-- ============================================================================

create table if not exists public.geo_reference (
  -- GeoNames' own id. Natural primary key, so a re-import updates in place.
  geonameid    bigint primary key,

  name         text not null,
  ascii_name   text,
  -- Alternate names, so "Roundu" finds "Rondu" and Urdu spellings match.
  alt_names    text,

  latitude     double precision,
  longitude    double precision,

  country_code char(2) not null,
  -- GeoNames admin hierarchy codes. admin1 = province, admin2 = district.
  admin1_code  text,
  admin2_code  text,
  admin3_code  text,

  -- A = country/state/region, P = city/village, T = mountain/hill,
  -- H = stream/lake, L = parks/area, V = forest/heath
  feature_class char(1),
  -- ADM1 | ADM2 | ADM3 | PPL | PPLA | PPLC | VAL | LK | MT | PASS | GLCR ...
  feature_code text,

  population   bigint,
  elevation    int,
  timezone     text,

  imported_at  timestamptz not null default now()
);

/* ---- Search indexes ----
   The admin types a few characters and expects results immediately, so this
   is a trigram index rather than full-text: full-text needs whole words and
   "skar" would match nothing. */
create extension if not exists pg_trgm;

create index if not exists geo_reference_name_trgm
  on public.geo_reference using gin (lower(name) gin_trgm_ops);
create index if not exists geo_reference_alt_trgm
  on public.geo_reference using gin (lower(coalesce(alt_names, '')) gin_trgm_ops);
create index if not exists geo_reference_country_idx
  on public.geo_reference (country_code);
create index if not exists geo_reference_feature_idx
  on public.geo_reference (feature_code);


-- ============================================================================
-- RLS
--
-- Reference data, not user data. Any signed-in admin can search it; there is
-- nothing private in it. Writes come from the import script with the
-- service-role key.
-- ============================================================================
alter table public.geo_reference enable row level security;

drop policy if exists geo_reference_read on public.geo_reference;
create policy geo_reference_read on public.geo_reference
  for select using (auth.role() = 'authenticated');

drop policy if exists geo_reference_admin_write on public.geo_reference;
create policy geo_reference_admin_write on public.geo_reference
  for all using (public.is_admin()) with check (public.is_admin());


-- ============================================================================
-- SEARCH
--
-- Returns the shape the Add Location form needs, already mapped to Rego's
-- own level names — so the form does not have to know what "PPLA2" means.
--
-- Ranking, in order:
--   1. exact name match
--   2. name starts with the query
--   3. administrative level (a district before a hamlet)
--   4. population
--
-- Without that ordering, typing "skardu" returns a dozen small villages
-- before the district itself.
-- ============================================================================
create or replace function public.search_geo_reference(
  p_query   text,
  p_country char(2) default 'PK',
  p_limit   int default 15
)
returns table (
  geonameid bigint,
  name text,
  suggested_type text,
  admin_path text,
  latitude double precision,
  longitude double precision,
  feature_code text,
  population bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with q as (select lower(btrim(coalesce(p_query, ''))) as term)
  select
    g.geonameid,
    g.name,
    /* Map GeoNames feature codes onto Rego's levels. Anything not listed is
       treated as an area, which is the safe default — an admin can change it. */
    case g.feature_code
      when 'ADM1'  then 'region'
      when 'ADM2'  then 'district'
      when 'ADM3'  then 'district'
      when 'PPLC'  then 'city'
      when 'PPLA'  then 'city'
      when 'PPLA2' then 'city'
      when 'PPLA3' then 'city'
      when 'PPL'   then 'city'
      else 'area'
    end as suggested_type,
    /* A readable hint so two places with the same name are distinguishable. */
    nullif(concat_ws(' · ',
      nullif(g.admin1_code, ''),
      nullif(g.admin2_code, ''),
      nullif(g.feature_code, '')
    ), '') as admin_path,
    g.latitude,
    g.longitude,
    g.feature_code,
    g.population
  from public.geo_reference g, q
  where g.country_code = coalesce(p_country, 'PK')
    and q.term <> ''
    and (
      lower(g.name) like q.term || '%'
      or lower(g.name) like '%' || q.term || '%'
      or lower(coalesce(g.alt_names, '')) like '%' || q.term || '%'
    )
  order by
    (lower(g.name) = q.term) desc,
    (lower(g.name) like q.term || '%') desc,
    case g.feature_code
      when 'ADM1' then 1 when 'ADM2' then 2 when 'ADM3' then 3
      when 'PPLC' then 4 when 'PPLA' then 5 when 'PPLA2' then 6
      when 'PPL'  then 7 else 8
    end,
    coalesce(g.population, 0) desc,
    g.name
  limit greatest(1, least(coalesce(p_limit, 15), 50));
$$;

revoke all on function public.search_geo_reference(text, char, int) from public;
grant execute on function public.search_geo_reference(text, char, int) to authenticated;


-- ============================================================================
-- VERIFY
-- ============================================================================
do $$
declare n bigint;
begin
  select count(*) into n from public.geo_reference;
  raise notice '--------------------------------------------';
  raise notice 'geo_reference rows: %', n;
  if n = 0 then
    raise notice '';
    raise notice 'Empty, as expected — this migration creates the table only.';
    raise notice 'Import the data with:';
    raise notice '    node scripts/import-geonames.mjs PK';
  end if;
  raise notice '--------------------------------------------';
end $$;


-- ============================================================================
-- ATTRIBUTION — a licence condition, not a courtesy
--
-- GeoNames is CC BY 4.0. Using it requires visible attribution wherever the
-- data is shown. This table is admin-only, so the attribution lives in the
-- Add Location form rather than on a public page — but if geo_reference data
-- ever reaches the public site, the credit has to go with it.
-- ============================================================================
comment on table public.geo_reference is
  'GeoNames reference data (https://www.geonames.org), CC BY 4.0. Lookup only — not the Rego location tree. Attribution required wherever this data is displayed.';


-- ============================================================================
-- ROLLBACK
-- ============================================================================
/*
drop function if exists public.search_geo_reference(text, char, int);
drop table    if exists public.geo_reference;
-- pg_trgm is left installed; other things may use it.
*/
