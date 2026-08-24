-- ============================================================================
-- Phase 84 — Fix the GeoNames search RPC signature
--
-- IDEMPOTENT. Replaces one function. No data changes.
--
-- ---------------------------------------------------------------------------
-- THE BUG — MINE, FROM phase83
--
-- phase83 declared the search function as:
--
--     search_geo_reference(p_query text, p_country char(2), p_limit int)
--
-- PostgREST resolves an RPC call by matching the JSON body's keys AND their
-- types against the function signature. A JSON string arrives as `text`, and
-- `text` does not match a `char(2)` parameter. PostgREST then reports:
--
--     Could not find the function public.search_geo_reference(...)
--     in the schema cache
--
-- Worse, src/lib/markets.ts swallows that error and returns [] — so the form
-- showed no suggestions and no error anywhere. A silent empty result is the
-- hardest kind of bug to find, and I wrote both halves of it.
--
-- Fix: take `text` and normalise inside the function. The column stays
-- char(2); only the parameter changes.
-- ---------------------------------------------------------------------------
--
-- PREREQUISITE: phase83-geo-reference.sql
-- ROLLBACK: bottom of file.
-- ============================================================================

-- The old signature has to go explicitly — CREATE OR REPLACE cannot change a
-- parameter type, and leaving both would give PostgREST an ambiguous overload.
drop function if exists public.search_geo_reference(text, char, int);
drop function if exists public.search_geo_reference(text, character, integer);

create or replace function public.search_geo_reference(
  p_query   text,
  p_country text default 'PK',
  p_limit   int  default 15
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
  with q as (
    select
      lower(btrim(coalesce(p_query, ''))) as term,
      -- Normalised here rather than in the signature, so PostgREST can match
      -- a plain JSON string and a lowercase country code still works.
      upper(btrim(coalesce(nullif(p_country, ''), 'PK')))::char(2) as cc
  )
  select
    g.geonameid,
    g.name,
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
  where g.country_code = q.cc
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

revoke all on function public.search_geo_reference(text, text, int) from public;
grant execute on function public.search_geo_reference(text, text, int) to authenticated;

comment on function public.search_geo_reference is
  'GeoNames lookup for the Add Location form. Parameters are all plain text/int so PostgREST can resolve the RPC — a char(2) parameter silently failed to match.';


-- ============================================================================
-- VERIFY — should return rows for a real place
-- ============================================================================
select geonameid, name, suggested_type, admin_path, population
from public.search_geo_reference('ska', 'PK', 10);

-- And with a lowercase country code, which the old version would have missed.
select count(*) as lowercase_cc_works
from public.search_geo_reference('hunza', 'pk', 10);


-- ============================================================================
-- ROLLBACK
-- ============================================================================
/*
drop function if exists public.search_geo_reference(text, text, int);
-- Then re-run the function block from phase83-geo-reference.sql.
*/
