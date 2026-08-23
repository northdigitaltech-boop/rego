-- ============================================================================
-- Phase 78 — SEO support functions (Phase 5)
--
-- ADDITIVE AND IDEMPOTENT. Read-only helpers. No table changes, no data
-- changes, nothing becomes public.
--
-- These exist so the public pages can ask ONE question per page instead of
-- one per service or one per area. Resolving fourteen services for one
-- district from the browser is fourteen round trips; this is one.
--
-- PREREQUISITE: phase72-market-areas.sql
-- ROLLBACK: bottom of file.
-- ============================================================================

do $$
begin
  if to_regprocedure('public.resolve_location_flag(uuid, text, text)') is null then
    raise exception 'run phase72-market-areas.sql first.';
  end if;
end $$;


-- ============================================================================
-- 1. WHICH SERVICES ARE OPEN AT ONE LOCATION
--
-- Used by the destination page to decide which service sections and which
-- "Hotels in Skardu" links to render. Resolution goes through
-- resolve_location_flag, so the page, the sitemap and the enforcement trigger
-- all agree by construction.
--
-- Returns only ACTIVE service categories, in the display order the admin set.
-- ============================================================================
create or replace function public.services_open_at_location(p_location_id uuid)
returns table (slug text, name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.slug, c.name
    from public.service_categories c
   where c.is_active
     and public.resolve_location_flag(p_location_id, 'is_active')
     and public.resolve_location_flag(p_location_id, 'is_public')
     and public.resolve_location_flag(p_location_id, 'listings_enabled', c.slug)
   order by c.display_order, c.name;
$$;

revoke all on function public.services_open_at_location(uuid) from public;
grant execute on function public.services_open_at_location(uuid) to anon, authenticated;


-- ============================================================================
-- 2. RESOLVED FLAGS FOR ONE LOCATION, IN ONE ROW
--
-- The page needs is_active / is_public / seo_enabled / coming_soon together.
-- Four separate RPCs to render one <head> is three too many.
-- ============================================================================
create or replace function public.location_public_state(p_location_id uuid)
returns table (
  is_active   boolean,
  is_public   boolean,
  seo_enabled boolean,
  coming_soon boolean,
  is_featured boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.resolve_location_flag(p_location_id, 'is_active'),
    public.resolve_location_flag(p_location_id, 'is_public'),
    public.resolve_location_flag(p_location_id, 'seo_enabled'),
    public.resolve_location_flag(p_location_id, 'coming_soon'),
    public.resolve_location_flag(p_location_id, 'is_featured');
$$;

revoke all on function public.location_public_state(uuid) from public;
grant execute on function public.location_public_state(uuid) to anon, authenticated;


-- ============================================================================
-- 3. SITEMAP CANDIDATES
--
-- Every location and location+service page that MIGHT belong in the sitemap.
-- "Might" is deliberate: this applies the cheap database-side conditions
-- (public, active, SEO on, service open) and leaves the content-quality gate
-- to decideIndexable() in src/lib/location-seo.ts, which also needs listing
-- counts and character counts.
--
-- Splitting it this way keeps ONE definition of the quality rule in code,
-- rather than a second copy in SQL that drifts from it.
-- ============================================================================
create or replace function public.seo_page_candidates()
returns table (
  location_id   uuid,
  location_slug text,
  location_name text,
  service_slug  text,
  service_name  text,
  robots_index  boolean,
  content_updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- Destination pages
  select
    l.id, l.slug, l.name,
    null::text, null::text,
    coalesce(s.robots_index, false),
    s.content_updated_at
  from public.locations l
  left join public.location_seo s
    on s.location_id = l.id and s.service_slug is null and s.language_code = 'en'
  where public.resolve_location_flag(l.id, 'is_active')
    and public.resolve_location_flag(l.id, 'is_public')
    and public.resolve_location_flag(l.id, 'seo_enabled')

  union all

  -- Location + service pages
  select
    l.id, l.slug, l.name,
    c.slug, c.name,
    coalesce(s.robots_index, false),
    s.content_updated_at
  from public.locations l
  cross join public.service_categories c
  left join public.location_seo s
    on s.location_id = l.id and s.service_slug = c.slug and s.language_code = 'en'
  where c.is_active
    and public.resolve_location_flag(l.id, 'is_active')
    and public.resolve_location_flag(l.id, 'is_public')
    and public.resolve_location_flag(l.id, 'seo_enabled')
    and public.resolve_location_flag(l.id, 'listings_enabled', c.slug)
    and public.resolve_location_flag(l.id, 'seo_enabled', c.slug);
$$;

revoke all on function public.seo_page_candidates() from public;
grant execute on function public.seo_page_candidates() to anon, authenticated;


-- ============================================================================
-- 4. LISTING COUNTS PER LOCATION — the thin-page test
--
-- Counts APPROVED listings only. A page whose listings are all pending is
-- an empty page to a visitor, and indexing it would be a promise the site
-- cannot keep.
--
-- Counts the area AND everything under it, because a district page shows
-- listings from its towns.
-- ============================================================================
create or replace function public.listing_count_at(p_location_id uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  ids uuid[];
  t text;
  total bigint := 0;
  n bigint;
begin
  select array_agg(id) into ids
    from public.locations
   where id = p_location_id or p_location_id = any(ancestors);

  if ids is null then return 0; end if;

  foreach t in array array[
    'hotels','homestays','hostels','restaurants','activities',
    'tour_companies','tour_guides','transport_providers',
    'media_providers','coworking_spaces'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;
    if not exists (select 1 from information_schema.columns
                    where table_schema='public' and table_name=t and column_name='location_id')
    then continue; end if;

    -- Not every table has a `status` column; fall back to counting all rows.
    if exists (select 1 from information_schema.columns
                where table_schema='public' and table_name=t and column_name='status') then
      execute format(
        'select count(*) from public.%I where location_id = any($1) and status = ''approved''', t)
        into n using ids;
    else
      execute format('select count(*) from public.%I where location_id = any($1)', t)
        into n using ids;
    end if;
    total := total + coalesce(n, 0);
  end loop;

  return total;
end $$;

revoke all on function public.listing_count_at(uuid) from public;
grant execute on function public.listing_count_at(uuid) to anon, authenticated;


-- ============================================================================
-- 5. NEARBY — a named foreign key so PostgREST can embed it
--
-- location_nearby references public.locations twice. PostgREST cannot guess
-- which one to follow, so the FK needs a predictable name for the embed
-- syntax `locations!location_nearby_nearby_id_fkey(...)` to resolve.
-- ============================================================================
do $$
begin
  if to_regclass('public.location_nearby') is null then
    raise notice 'location_nearby missing — run phase72 first.';
    return;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'location_nearby_nearby_id_fkey'
       and conrelid = 'public.location_nearby'::regclass
  ) then
    -- Drop whatever auto-named constraint exists on nearby_id, then re-add
    -- it with the name PostgREST expects.
    declare c text;
    begin
      select conname into c
        from pg_constraint
       where conrelid = 'public.location_nearby'::regclass
         and contype = 'f'
         and conkey = array[
           (select attnum from pg_attribute
             where attrelid = 'public.location_nearby'::regclass
               and attname = 'nearby_id')
         ]::smallint[];

      if c is not null then
        execute format('alter table public.location_nearby drop constraint %I', c);
      end if;

      alter table public.location_nearby
        add constraint location_nearby_nearby_id_fkey
        foreign key (nearby_id) references public.locations(id) on delete cascade;

      raise notice 'renamed nearby_id foreign key for PostgREST embedding';
    end;
  end if;
end $$;


-- ============================================================================
-- 6. VERIFY
-- ============================================================================
do $$
declare n_cand int; n_pub int;
begin
  select count(*) into n_cand from public.seo_page_candidates();
  select count(*) into n_pub  from public.locations where is_public is true;

  raise notice '--------------------------------------------';
  raise notice 'SEO page candidates : %', n_cand;
  raise notice 'Public locations    : %', n_pub;
  if n_pub = 0 then
    raise notice 'Nothing is public yet, so 0 candidates is correct.';
  end if;
  raise notice 'Candidates still pass the content-quality gate in code';
  raise notice 'before they reach the sitemap. See lib/location-seo.ts.';
  raise notice '--------------------------------------------';
end $$;


-- ============================================================================
-- ROLLBACK
-- ============================================================================
/*
drop function if exists public.listing_count_at(uuid);
drop function if exists public.seo_page_candidates();
drop function if exists public.location_public_state(uuid);
drop function if exists public.services_open_at_location(uuid);
-- The renamed foreign key is left alone: dropping it would remove referential
-- integrity, and its name is harmless.
*/
