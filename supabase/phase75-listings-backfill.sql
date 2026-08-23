-- ============================================================================
-- Phase 75 — Listings backfill: attach every listing to a location
--            (Phase 2, step 2 of 2 — the APPLY script)
--
-- IDEMPOTENT. Re-runnable. Reversible. Nothing becomes public.
--
-- ---------------------------------------------------------------------------
-- WHAT IT WRITES
--   Exactly two columns, on listing tables, and ONLY where they are NULL:
--       location_id, market_id
--   Both were added by phase72 and have been NULL ever since.
--
-- WHAT IT NEVER TOUCHES
--   • The free-text `location` / `city` columns. They stay exactly as they
--     are. They remain what the provider typed and what the UI shows today.
--     If this backfill turns out wrong, the truth is still there to redo it.
--   • Any row that already has a location_id. A human decision made in the
--     admin must never be overwritten by a re-run of a bulk script.
--   • Anything else. No status, no price, no approval flag.
--
-- ---------------------------------------------------------------------------
-- THE RULE, AND WHY IT IS DELIBERATELY NARROW
--
--   Applied automatically:  ALIAS (you decided it)  and  EXACT (unambiguous)
--   NEVER applied:          REVIEW (a guess)        and  UNMATCHED
--
-- A "REVIEW" match means a known place name appears somewhere inside the
-- text — "near shangrila skardu road" contains "skardu". That is usually
-- right and occasionally very wrong, and a hotel filed under the wrong
-- district produces wrong search results, wrong SEO pages and wrong area
-- controls that nobody notices for months. So REVIEW rows are reported and
-- left NULL until you turn them into aliases.
--
-- A NULL location_id is a safe state: Phase 4 validates NEW submissions and
-- leaves already-stored rows alone.
-- ---------------------------------------------------------------------------
--
-- PREREQUISITES: phase72, phase73, phase74
-- ROLLBACK: bottom of file. It is a clean one-liner because we only ever
--           wrote into columns that started life NULL.
-- ============================================================================

do $$
begin
  if to_regclass('public.locations') is null then
    raise exception 'run phase72-market-areas.sql first.';
  end if;
  if to_regprocedure('public.norm_location_text(text)') is null then
    raise exception 'run phase73-backfill-report.sql first.';
  end if;
  if to_regclass('public.place_district_reference') is null then
    raise exception 'run phase74-gb-geography.sql first.';
  end if;
end $$;


-- ============================================================================
-- 1. RESOLVER — free text in, location id out, or NULL.
--
-- One function, used by both the dry run and the apply pass, so the preview
-- cannot disagree with what actually happens. Every ladder rung is explicit
-- and returns WHY it matched, because "why" is the only way you can audit a
-- bulk change afterwards.
--
-- Ladder, most trustworthy first:
--   1. ALIAS      — you wrote this mapping down yourself
--   2. EXACT      — text equals a location name or slug outright
--   3. PLACE_REF  — text equals a curated place from phase74 (high confidence)
--   4. REVIEW     — a location name appears as a whole word inside the text
--   5. UNMATCHED
--
-- Rungs 1-3 are safe to apply. 4 and 5 are not.
-- ============================================================================
create or replace function public.resolve_free_text_location(p_text text)
returns table (location_id uuid, match_kind text, matched_on text)
language plpgsql
stable
as $$
declare
  v_norm text := public.norm_location_text(p_text);
  v_id   uuid;
  v_on   text;
begin
  if v_norm is null then
    return query select null::uuid, 'UNMATCHED'::text, null::text;
    return;
  end if;

  -- 1. Explicit human decision.
  select a.location_id, a.alias_norm into v_id, v_on
    from public.location_aliases a
   where a.alias_norm = v_norm
   limit 1;
  if v_id is not null then
    return query select v_id, 'ALIAS'::text, v_on;
    return;
  end if;

  -- 2. Exact name or slug. Deepest wins, so an area beats the district that
  --    shares its name — the more specific answer is the better one.
  select l.id, l.name into v_id, v_on
    from public.locations l
   where public.norm_location_text(l.name) = v_norm
      or l.slug = replace(v_norm, ' ', '-')
   order by l.depth desc
   limit 1;
  if v_id is not null then
    return query select v_id, 'EXACT'::text, v_on;
    return;
  end if;

  -- 3. Curated place reference (high confidence only). Resolves to the AREA
  --    if one exists for that place, otherwise to the district itself.
  select coalesce(area.id, dist.id), p.place_name into v_id, v_on
    from public.place_district_reference p
    join public.locations dist
      on dist.slug = p.district_slug and dist.location_type = 'district'
    left join public.locations area
      on area.parent_id = dist.id
     and public.norm_location_text(area.name) = public.norm_location_text(p.place_name)
   where p.match_norm = v_norm
     and p.confidence = 'high'
   limit 1;
  if v_id is not null then
    return query select v_id, 'PLACE_REF'::text, v_on;
    return;
  end if;

  -- 4. Whole-word containment. A SUGGESTION. Never applied.
  select l.id, l.name into v_id, v_on
    from public.locations l
   where v_norm ~ ('(^| )' || public.norm_location_text(l.name) || '( |$)')
   order by length(l.name) desc, l.depth desc
   limit 1;
  if v_id is not null then
    return query select v_id, 'REVIEW'::text, v_on;
    return;
  end if;

  return query select null::uuid, 'UNMATCHED'::text, null::text;
end $$;

comment on function public.resolve_free_text_location is
  'Resolves a free-text place string to a location id. Only ALIAS, EXACT and PLACE_REF results are safe to apply automatically.';


-- ============================================================================
-- 2. THE BACKFILL
--
-- Schema-aware, like phase73: it asks information_schema which tables have a
-- usable place column instead of assuming. `events`, `roadside_providers` and
-- `stories` only have `city`; several tables have both `location` and `city`,
-- and for those `location` is tried first because it is the more specific
-- field.
--
-- p_dry_run defaults to TRUE. You have to ask for the write.
-- ============================================================================
create or replace function public.backfill_listing_locations(p_dry_run boolean default true)
returns table (
  source_table text,
  match_kind   text,
  rows_matched bigint,
  applied      boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  candidate_tables text[] := array[
    'hotels','homestays','hostels','restaurants','activities','events',
    'tour_companies','tour_guides','transport_providers','media_providers',
    'coworking_spaces','roadside_providers','stories',
    'expedition_companies','expedition_pros'
  ];
  t text;
  col text;
  m_pk uuid;
begin
  /* is_admin() reads auth.uid(), which is NULL in the Supabase SQL editor.
     Allow a real admin session OR a direct privileged connection. */
  if not (public.is_admin() or current_user in ('postgres','supabase_admin','service_role')) then
    raise exception 'admin only (current_user=%)', current_user;
  end if;

  select id into m_pk from public.markets where slug = 'pakistan';

  create temp table if not exists _bf(
    tbl text, kind text, n bigint, did boolean
  ) on commit drop;
  delete from _bf;

  foreach t in array candidate_tables loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    -- The columns phase72 added. If they are missing, phase72 skipped this
    -- table and we must not invent them here.
    if not exists (
      select 1 from information_schema.columns
       where table_schema='public' and table_name=t and column_name='location_id'
    ) then
      raise notice 'skip %: no location_id column (phase72 did not touch it)', t;
      continue;
    end if;

    -- Prefer `location`; fall back to `city`.
    col := null;
    if exists (select 1 from information_schema.columns
                where table_schema='public' and table_name=t and column_name='location') then
      col := 'location';
    elsif exists (select 1 from information_schema.columns
                   where table_schema='public' and table_name=t and column_name='city') then
      col := 'city';
    else
      raise notice 'skip %: no location or city column', t;
      continue;
    end if;

    -- Count what each rung would do. Always runs, dry or not, so the summary
    -- describes the same set of rows the update touches.
    execute format($q$
      insert into _bf(tbl, kind, n, did)
      select %L, r.match_kind, count(*), false
        from public.%I x
        cross join lateral public.resolve_free_text_location(x.%I::text) r
       where x.location_id is null
         and x.%I is not null
         and btrim(x.%I::text) <> ''
       group by r.match_kind
    $q$, t, t, col, col, col);

    if not p_dry_run then
      -- Apply the safe rungs only. `where location_id is null` makes the
      -- write idempotent and protects any manual admin decision.
      execute format($q$
        update public.%I x
           set location_id = r.location_id,
               market_id   = %L
          from lateral public.resolve_free_text_location(x.%I::text) r
         where x.location_id is null
           and r.location_id is not null
           and r.match_kind in ('ALIAS','EXACT','PLACE_REF')
      $q$, t, m_pk, col);

      update _bf set did = true
       where tbl = t and kind in ('ALIAS','EXACT','PLACE_REF');
    end if;

    raise notice '% (%): processed', t, col;
  end loop;

  return query
    select b.tbl, b.kind, b.n, b.did
      from _bf b
     order by b.tbl,
              case b.kind when 'ALIAS' then 1 when 'EXACT' then 2
                          when 'PLACE_REF' then 3 when 'REVIEW' then 4
                          else 5 end;
end $$;

revoke all on function public.backfill_listing_locations(boolean) from public;
grant execute on function public.backfill_listing_locations(boolean) to authenticated;


-- ============================================================================
-- 3. DRY RUN — this is what running this file actually does.
--
-- READ THIS OUTPUT BEFORE APPLYING.
--   ALIAS / EXACT / PLACE_REF  → will be written
--   REVIEW / UNMATCHED         → will be left NULL
-- ============================================================================
select * from public.backfill_listing_locations(true);


-- ============================================================================
-- 4. WHAT WOULD BE LEFT BEHIND — the unmatched report
--
-- Every distinct free-text value that will NOT be linked, biggest first.
-- Each row here is one alias away from being resolved.
-- ============================================================================
drop table if exists public.listing_location_gaps;
create table public.listing_location_gaps (
  id           uuid primary key default gen_random_uuid(),
  source_table text not null,
  raw_text     text not null,
  normalised   text,
  row_count    bigint not null,
  match_kind   text not null,
  guess_name   text,
  alias_sql    text,
  generated_at timestamptz not null default now()
);

alter table public.listing_location_gaps enable row level security;
drop policy if exists llg_admin_read on public.listing_location_gaps;
create policy llg_admin_read on public.listing_location_gaps
  for select using (public.is_admin());

do $$
declare
  candidate_tables text[] := array[
    'hotels','homestays','hostels','restaurants','activities','events',
    'tour_companies','tour_guides','transport_providers','media_providers',
    'coworking_spaces','roadside_providers','stories',
    'expedition_companies','expedition_pros'
  ];
  t text; col text;
begin
  foreach t in array candidate_tables loop
    if to_regclass('public.' || t) is null then continue; end if;

    col := null;
    if exists (select 1 from information_schema.columns
                where table_schema='public' and table_name=t and column_name='location') then
      col := 'location';
    elsif exists (select 1 from information_schema.columns
                   where table_schema='public' and table_name=t and column_name='city') then
      col := 'city';
    else
      continue;
    end if;

    execute format($q$
      insert into public.listing_location_gaps
        (source_table, raw_text, normalised, row_count, match_kind, guess_name, alias_sql)
      select
        %L,
        x.%I::text,
        public.norm_location_text(x.%I::text),
        count(*),
        r.match_kind,
        r.matched_on,
        format(
          'insert into public.location_aliases (alias_norm, location_id, note) values (%%L, %%L, %%L);',
          public.norm_location_text(x.%I::text),
          coalesce(r.location_id::text, '<PASTE-LOCATION-ID>'),
          'from ' || %L
        )
        from public.%I x
        cross join lateral public.resolve_free_text_location(x.%I::text) r
       where x.location_id is null
         and x.%I is not null
         and btrim(x.%I::text) <> ''
         and r.match_kind in ('REVIEW','UNMATCHED')
       group by x.%I, r.match_kind, r.matched_on, r.location_id
    $q$, t, col, col, col, t, t, col, col, col, col);
  end loop;
end $$;

select source_table, raw_text, row_count, match_kind, guess_name
from public.listing_location_gaps
order by case match_kind when 'UNMATCHED' then 1 else 2 end, row_count desc;


-- ============================================================================
-- 5. TO APPLY
--
-- Only after reading sections 3 and 4:
--
--     select * from public.backfill_listing_locations(false);
--
-- Then re-run this whole file to confirm the numbers moved the way you
-- expected. Running it twice changes nothing the second time.
--
-- To resolve a gap, copy the ready-made statement:
--
--     select alias_sql from public.listing_location_gaps
--      where raw_text = 'Near Shangrila, Skardu Road';
--
-- ...check the location id it suggests is genuinely right, run it, then run
-- the apply again. Only the newly-resolved rows change.
-- ============================================================================


-- ============================================================================
-- 6. COVERAGE — the number that tells you whether Phase 4 can be trusted
--
-- Phase 4 enforcement is only meaningful for rows that HAVE a location. This
-- is the honest measure of how far that goes.
-- ============================================================================
do $$
declare
  t text; total bigint; linked bigint;
  g_total bigint := 0; g_linked bigint := 0;
begin
  raise notice '---------------------------------------------';
  raise notice ' table                     linked / total';
  raise notice '---------------------------------------------';
  foreach t in array array[
    'hotels','homestays','hostels','restaurants','activities','events',
    'tour_companies','tour_guides','transport_providers','media_providers',
    'coworking_spaces','roadside_providers','stories'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;
    if not exists (select 1 from information_schema.columns
                    where table_schema='public' and table_name=t and column_name='location_id') then
      continue;
    end if;
    execute format('select count(*), count(location_id) from public.%I', t)
      into total, linked;
    g_total := g_total + total; g_linked := g_linked + linked;
    raise notice ' %-25s % / %', t, linked, total;
  end loop;
  raise notice '---------------------------------------------';
  raise notice ' TOTAL                     % / %  (%%%)', g_linked, g_total,
    case when g_total = 0 then 0 else round(100.0 * g_linked / g_total) end;
  raise notice '---------------------------------------------';
  if g_linked < g_total then
    raise notice 'Unlinked rows are NOT broken. They keep working exactly as';
    raise notice 'they do today; they simply cannot be governed by area rules';
    raise notice 'until they are linked.';
  end if;
end $$;


-- ============================================================================
-- ROLLBACK
--
-- Clean, because this script only ever wrote into columns that were NULL
-- before it ran. Nothing else was modified, so nothing else needs undoing.
--
-- WARNING: this also clears any location_id an admin set BY HAND after the
-- backfill. If that has happened, filter by updated_at or skip this.
-- ============================================================================
/*
do $$
declare t text;
begin
  foreach t in array array[
    'hotels','homestays','hostels','restaurants','activities','events',
    'tour_companies','tour_guides','transport_providers','media_providers',
    'coworking_spaces','roadside_providers','stories',
    'expedition_companies','expedition_pros'
  ] loop
    if to_regclass('public.' || t) is not null
       and exists (select 1 from information_schema.columns
                    where table_schema='public' and table_name=t and column_name='location_id')
    then
      execute format('update public.%I set location_id = null, market_id = null', t);
    end if;
  end loop;
end $$;

drop table    if exists public.listing_location_gaps;
drop function if exists public.backfill_listing_locations(boolean);
drop function if exists public.resolve_free_text_location(text);
*/
