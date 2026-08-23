-- ============================================================================
-- Phase 73 — Location backfill REPORT (Phase 2, step 1 of 2)
--
-- ****  THIS SCRIPT WRITES NOTHING TO EXISTING TABLES.  ****
--
-- It reads your listing tables and writes ONE new report table. Run it, read
-- the output, decide what the unmatched rows should map to, and only then run
-- the apply script.
--
-- ---------------------------------------------------------------------------
-- WHY THIS VERSION IS SCHEMA-AWARE
--
-- The first version hardcoded a list of tables and assumed every one had a
-- `location` column. It does not:
--
--     events               -> city, venue, address   (NO location)
--     roadside_providers   -> address, city          (NO location)
--     stories              -> city                   (NO location)
--     restaurants          -> location AND city
--     activities           -> location AND city
--     media_providers      -> location AND city
--     coworking_spaces     -> location AND city
--
-- A static UNION ALL therefore aborts on the first missing column and you
-- learn nothing about the other tables. This version asks
-- information_schema which (table, column) pairs actually exist and only
-- reads those. Adding a table later needs no edit here.
-- ---------------------------------------------------------------------------
--
-- WHY A REPORT BEFORE AN APPLY
--   Locations are free text: "Skardu", "Skardu Baltistan", "Near Shangrila,
--   Skardu Road", "skardu ". Some map to one district with certainty. Some do
--   not. Guessing would silently attach a hotel to the wrong district, and
--   once bookings and SEO pages depend on it, that is expensive to find and
--   worse to undo.
--
-- PREREQUISITE: phase72-market-areas.sql
-- ============================================================================

do $$
begin
  if to_regclass('public.locations') is null then
    raise exception 'public.locations is missing — run phase72-market-areas.sql first.';
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- Normalisation: lowercase, strip punctuation, collapse whitespace.
-- Deliberately conservative — it does not stem, translate or guess.
-- "Hunza Valley" becomes "hunza valley", NOT "hunza".
-- ---------------------------------------------------------------------------
create or replace function public.norm_location_text(s text)
returns text
language sql
immutable
as $$
  select nullif(trim(regexp_replace(lower(coalesce(s, '')), '[^a-z0-9]+', ' ', 'g')), '');
$$;


-- ---------------------------------------------------------------------------
-- The report table. Rebuilt in full each run; it holds no decisions, only
-- observations. Your decisions live in location_aliases further down.
-- ---------------------------------------------------------------------------
create table if not exists public.location_backfill_report (
  id            uuid primary key default gen_random_uuid(),
  source_table  text not null,
  source_column text not null,
  raw_location  text not null,
  normalised    text,
  row_count     bigint not null,
  suggested_location_id uuid,
  suggested_name text,
  suggested_path text,
  match_status  text not null,   -- EXACT | ALIAS | REVIEW | UNMATCHED
  generated_at  timestamptz not null default now()
);

create index if not exists lbr_status_idx on public.location_backfill_report (match_status);
create index if not exists lbr_table_idx  on public.location_backfill_report (source_table);

alter table public.location_backfill_report enable row level security;

drop policy if exists lbr_admin_read on public.location_backfill_report;
create policy lbr_admin_read on public.location_backfill_report
  for select using (public.is_admin());
-- No write policy: rebuilt by the function below, which runs as definer.


-- ---------------------------------------------------------------------------
-- Alias table — where a human records "this free text means this location".
-- Defined BEFORE the refresh function because the function reads it.
--
-- The apply script will read ONLY exact matches and this table. REVIEW
-- suggestions are never applied on their own; they exist to make filling this
-- table fast, not to bypass the decision.
-- ---------------------------------------------------------------------------
create table if not exists public.location_aliases (
  id          uuid primary key default gen_random_uuid(),
  alias_norm  text not null unique,
  location_id uuid not null references public.locations(id) on delete restrict,
  note        text,
  created_at  timestamptz not null default now(),
  created_by  uuid
);

alter table public.location_aliases enable row level security;

drop policy if exists location_aliases_admin_read on public.location_aliases;
create policy location_aliases_admin_read on public.location_aliases
  for select using (public.is_admin());

drop policy if exists location_aliases_admin_write on public.location_aliases;
create policy location_aliases_admin_write on public.location_aliases
  for all using (public.is_admin()) with check (public.is_admin());


-- ---------------------------------------------------------------------------
-- Rebuild the report.
--
-- Discovers every (table, column) pair that actually exists from a candidate
-- list of column names, then samples each one. Tables or columns that are
-- absent are skipped with a NOTICE instead of aborting the run.
--
-- SECURITY DEFINER so it can read every listing table regardless of the
-- caller's RLS, but the search_path is pinned and it is EXECUTE-restricted
-- to authenticated users below. It only ever reads and only ever writes to
-- its own report table.
-- ---------------------------------------------------------------------------
create or replace function public.refresh_location_backfill_report()
returns table (checked_pairs int, skipped_pairs int, distinct_values bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  candidate_tables text[] := array[
    'hotels','homestays','hostels','restaurants','activities','events',
    'tour_companies','tour_guides','transport_providers','media_providers',
    'destinations','coworking_spaces','roadside_providers','stories',
    'expedition_companies','expedition_pros'
  ];
  -- Column names that hold a place, in priority order. `city` is included
  -- because several tables have only that.
  candidate_cols text[] := array['location','city'];
  t text;
  c text;
  n_checked int := 0;
  n_skipped int := 0;
begin
  /* Authorisation.
     public.is_admin() reads auth.uid(), which is NULL in the Supabase SQL
     editor — there is no logged-in user there, the query runs as postgres.
     So allow either a real admin session OR a direct privileged connection.
     Both are legitimate ways to run a report; neither lets an ordinary
     signed-in user call this. */
  if not (
    public.is_admin()
    or current_user in ('postgres', 'supabase_admin', 'service_role')
  ) then
    raise exception 'admin only (current_user=%, auth.uid()=%)', current_user, auth.uid();
  end if;

  delete from public.location_backfill_report;

  foreach t in array candidate_tables loop
    if to_regclass('public.' || t) is null then
      raise notice 'skip %: table not present', t;
      n_skipped := n_skipped + 1;
      continue;
    end if;

    foreach c in array candidate_cols loop
      if not exists (
        select 1 from information_schema.columns
         where table_schema = 'public' and table_name = t and column_name = c
      ) then
        n_skipped := n_skipped + 1;
        continue;
      end if;

      n_checked := n_checked + 1;
      raise notice 'reading %.%', t, c;

      execute format($q$
        insert into public.location_backfill_report
          (source_table, source_column, raw_location, normalised, row_count,
           suggested_location_id, suggested_name, suggested_path, match_status)
        with vals as (
          select %L::text as st,
                 %L::text as sc,
                 %I::text as raw,
                 public.norm_location_text(%I::text) as norm
            from public.%I
           where %I is not null and btrim(%I::text) <> ''
        ),
        counted as (
          select st, sc, raw, norm, count(*) as n
            from vals
           group by st, sc, raw, norm
        ),
        resolved as (
          select
            c.*,
            -- 1. an explicit human decision always wins
            (select a.location_id from public.location_aliases a
              where a.alias_norm = c.norm limit 1) as alias_id,
            -- 2. exact name or slug match
            (select l.id from public.locations l
              where public.norm_location_text(l.name) = c.norm
                 or l.slug = replace(c.norm, ' ', '-')
              order by l.depth desc limit 1) as exact_id,
            -- 3. a known location name appears as a whole word inside the
            --    text. A SUGGESTION for a human, never auto-applied.
            (select l.id from public.locations l
              where c.norm ~ ('(^| )' || public.norm_location_text(l.name) || '( |$)')
              order by length(l.name) desc, l.depth desc limit 1) as fuzzy_id
          from counted c
        )
        select
          r.st, r.sc, r.raw, r.norm, r.n,
          coalesce(r.alias_id, r.exact_id, r.fuzzy_id),
          l.name,
          array_to_string(l.path_slugs, ' / '),
          case
            when r.alias_id is not null then 'ALIAS'
            when r.exact_id is not null then 'EXACT'
            when r.fuzzy_id is not null then 'REVIEW'
            else 'UNMATCHED'
          end
        from resolved r
        left join public.locations l
          on l.id = coalesce(r.alias_id, r.exact_id, r.fuzzy_id)
      $q$, t, c, c, c, t, c, c);
    end loop;
  end loop;

  return query
    select n_checked, n_skipped, count(*) from public.location_backfill_report;
end $$;

revoke all on function public.refresh_location_backfill_report() from public;
grant execute on function public.refresh_location_backfill_report() to authenticated;

comment on function public.refresh_location_backfill_report is
  'Rebuilds public.location_backfill_report by discovering which listing tables actually have a location/city column. Reads only; writes nothing to listing tables. Admin only.';


-- ============================================================================
-- RUN IT
-- ============================================================================
select * from public.refresh_location_backfill_report();


-- ============================================================================
-- REPORT 1 — Summary. Start here.
-- ============================================================================
select
  match_status,
  count(*)       as distinct_values,
  sum(row_count) as affected_rows
from public.location_backfill_report
group by match_status
order by
  case match_status
    when 'UNMATCHED' then 1 when 'REVIEW' then 2
    when 'ALIAS' then 3 else 4 end;


-- ============================================================================
-- REPORT 2 — Which tables were actually readable
--
-- If a table you expected is missing here, it has neither a `location` nor a
-- `city` column. That is a finding, not an error — it means those rows cannot
-- be placed on the map without a schema decision first.
-- ============================================================================
select source_table, source_column,
       count(*) as distinct_values, sum(row_count) as rows
from public.location_backfill_report
group by source_table, source_column
order by source_table, source_column;


-- ============================================================================
-- REPORT 3 — Everything needing a decision, worst first.
--
-- Resolve every UNMATCHED row before running the apply script. Either add the
-- missing location in the admin, or record an alias (see the template below).
-- ============================================================================
select match_status, source_table, source_column, raw_location,
       row_count, suggested_name, suggested_path
from public.location_backfill_report
where match_status in ('UNMATCHED', 'REVIEW')
order by
  case match_status when 'UNMATCHED' then 1 else 2 end,
  row_count desc;


-- ============================================================================
-- REPORT 4 — Clean matches, for sanity-checking before applying
-- ============================================================================
select source_table, source_column, raw_location, row_count, suggested_path
from public.location_backfill_report
where match_status in ('EXACT', 'ALIAS')
order by row_count desc;


-- ============================================================================
-- HOW TO RECORD A DECISION
--
-- Copy the exact value from the `normalised` column of report 3 — not the raw
-- text, and not something you retyped. Then re-run:
--     select * from public.refresh_location_backfill_report();
-- and the row moves to ALIAS.
-- ============================================================================
/*
insert into public.location_aliases (alias_norm, location_id, note)
select 'near shangrila skardu road', id, 'Shangrila resort sits in Skardu district'
  from public.locations where slug = 'skardu'
on conflict (alias_norm) do nothing;
*/


-- ============================================================================
-- REPORT 5 — Duplicate slugs among siblings
-- Should return zero rows. A duplicate here becomes two URLs for one place.
-- ============================================================================
select market_id, parent_id, slug, count(*)
from public.locations
group by market_id, parent_id, slug
having count(*) > 1;


-- ============================================================================
-- REPORT 6 — Destination drift
--
-- ---------------------------------------------------------------------------
-- READ THE STATUS COLUMN CAREFULLY. "SLUG DIFFERS" IS NOT A PROBLEM TO FIX
-- BY RENAMING.
--
-- Destination slugs are LIVE, INDEXED URLs: /destinations/hunza-valley is a
-- real page Google already knows. The location tree uses the administrative
-- name ("Hunza" the district). These two SHOULD differ — a district and a
-- destination page are not the same object.
--
-- So the fix is never "rename the destination to match the location". It is
-- to record the relationship, keep the existing URL exactly as it is, and let
-- the location tree sit behind it.
--
-- An earlier version of this report compared slugs directly and reported
-- every one of these as broken. That was wrong and would have led straight to
-- renaming live URLs. This version uses the same resolution ladder as the
-- main report: explicit alias, then exact name match, then whole-word name
-- match.
-- ---------------------------------------------------------------------------
--
-- Note also: public.destinations and the hardcoded array in src/lib/data.ts
-- are two separate sources, and the sitemap currently reads the CODE one.
-- Reconcile before location pages go live, or the sitemap and the site will
-- disagree about which destinations exist.
-- ============================================================================
with d as (
  select
    id, slug, name,
    public.norm_location_text(name) as norm_name,
    public.norm_location_text(slug) as norm_slug
  from public.destinations
),
resolved as (
  select
    d.*,
    -- 1. explicit human decision, on either the name or the slug text
    (select a.location_id from public.location_aliases a
      where a.alias_norm in (d.norm_name, d.norm_slug) limit 1) as alias_id,
    -- 2. exact match on location name or slug
    (select l.id from public.locations l
      where public.norm_location_text(l.name) in (d.norm_name, d.norm_slug)
         or l.slug = d.slug
      order by l.depth desc limit 1) as exact_id,
    -- 3. location name appears as a whole word: "hunza valley" contains "hunza"
    (select l.id from public.locations l
      where d.norm_name ~ ('(^| )' || public.norm_location_text(l.name) || '( |$)')
         or d.norm_slug ~ ('(^| )' || public.norm_location_text(l.name) || '( |$)')
      order by length(l.name) desc, l.depth desc limit 1) as fuzzy_id
  from d
)
select
  r.slug as destination_slug,
  r.name as destination_name,
  coalesce(r.alias_id, r.exact_id, r.fuzzy_id) as matched_location_id,
  l.name as matched_location,
  array_to_string(l.path_slugs, ' / ') as matched_path,
  case
    when r.alias_id is not null then 'ALIAS — decided by you'
    when r.exact_id is not null then 'EXACT'
    when r.fuzzy_id is not null then 'SLUG DIFFERS — keep the URL, confirm the link'
    else 'UNMATCHED — no location for this destination yet'
  end as status,
  case
    when coalesce(r.alias_id, r.exact_id) is not null then null
    else format(
      $tpl$insert into public.location_aliases (alias_norm, location_id, note) values (%L, %L, 'destination %s');$tpl$,
      r.norm_name,
      coalesce(r.fuzzy_id::text, '<PASTE-LOCATION-ID>'),
      r.slug)
  end as suggested_alias_sql
from resolved r
left join public.locations l on l.id = coalesce(r.alias_id, r.exact_id, r.fuzzy_id)
order by
  case
    when r.alias_id is not null then 4
    when r.exact_id is not null then 3
    when r.fuzzy_id is not null then 2
    else 1
  end,
  r.slug;


-- ============================================================================
-- REPORT 7 — Destinations with no location at all
--
-- These need a location created in the tree before their page can be governed
-- by area controls. "Naran" and "Fairy Meadows", for example, are not in
-- Gilgit-Baltistan's district list — Naran is in Khyber Pakhtunkhwa, and
-- Fairy Meadows sits inside Diamer. Neither is a district.
--
-- This is the concrete evidence that the seeded district list in phase72 is
-- not sufficient on its own. Do not "fix" it by forcing every destination to
-- be a district; add the right level (city, area) under the right parent.
-- ============================================================================
select
  d.slug,
  d.name,
  d.location as free_text_location,
  'needs a location row — decide its parent and location_type' as action
from public.destinations d
where not exists (
  select 1 from public.locations l
   where public.norm_location_text(l.name) in (
           public.norm_location_text(d.name),
           public.norm_location_text(d.slug))
      or l.slug = d.slug
      or public.norm_location_text(d.name) ~ ('(^| )' || public.norm_location_text(l.name) || '( |$)')
)
order by d.slug;


-- ============================================================================
-- ROLLBACK
-- ============================================================================
/*
drop function if exists public.refresh_location_backfill_report();
drop table    if exists public.location_backfill_report;
drop table    if exists public.location_aliases;
drop function if exists public.norm_location_text(text);
-- Also drop the old view if the first version of this file was ever run:
drop view     if exists public.v_location_backfill_report cascade;
*/
