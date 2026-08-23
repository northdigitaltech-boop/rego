-- ============================================================================
-- Phase 76 — Area rule ENFORCEMENT (Phase 4)
--
-- ****  SHIPS DISABLED. Running this file changes NO behaviour.  ****
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS A DATABASE TRIGGER AND NOT AN API CHECK
--
-- Rego's provider forms insert straight from the browser with the anon key:
--
--     export async function createHotel(input: HotelInput) {
--       return supabase.from("hotels").insert({ ...input, category: "hotels" })
--     }
--
-- There is no server route in between. So a check in the form would stop the
-- form and nothing else — anyone holding the anon key can POST to Supabase's
-- REST endpoint directly and skip it entirely.
--
-- The brief says "disabled locations cannot be submitted by manually calling
-- the API" and "do not depend only on hiding options in the frontend". With
-- this architecture there are exactly two ways to honour that:
--
--   (a) move listing creation into a server route — a redesign of twelve
--       working provider dashboards, which the brief forbids; or
--   (b) enforce in the database, where the anon key cannot get past it.
--
-- (b) is what this file does. It needs no change to any provider form, covers
-- every table at once, and can be switched off in one UPDATE.
-- ---------------------------------------------------------------------------
--
-- WHAT IT NEVER DOES
--   • Never touches an existing row. INSERT only, plus UPDATEs that MOVE a
--     listing to a different area.
--   • Never blocks editing a listing that is already stored — a provider can
--     still fix a price or a photo in an area that has been closed.
--   • Never affects bookings that already exist.
--   • Never deletes anything.
--
-- PREREQUISITES: phase72 (locations, resolve_location_flag), phase75 optional
-- ROLLBACK: bottom of file.
-- ============================================================================

do $$
begin
  if to_regprocedure('public.resolve_location_flag(uuid, text, text)') is null then
    raise exception 'run phase72-market-areas.sql first.';
  end if;
end $$;


-- ============================================================================
-- 1. THE SWITCH
--
-- One row. Enforcement is OFF until somebody deliberately turns it on, and
-- the two halves are separate on purpose:
--
--   enforce_enabled      — check the rules for listings that HAVE an area
--   require_location_id  — refuse listings that have NO area at all
--
-- The second is the dangerous one. Until phase75 backfill is complete and the
-- provider forms actually send a location_id, turning it on rejects every
-- new listing site-wide. It is separate so it cannot be switched on by
-- accident along with the first.
-- ============================================================================
create table if not exists public.market_enforcement (
  id                  boolean primary key default true,
  enforce_enabled     boolean not null default false,
  require_location_id boolean not null default false,
  -- Shown to the provider when a submission is refused. Kept editable so the
  -- wording can be fixed without a deploy.
  blocked_message     text not null default
    'We are not accepting new listings in this area right now. Please contact Rego support if you think this is wrong.',
  updated_at          timestamptz not null default now(),
  updated_by          uuid,
  constraint market_enforcement_single_row check (id)
);

insert into public.market_enforcement (id) values (true) on conflict (id) do nothing;

alter table public.market_enforcement enable row level security;

-- Readable by anyone: the provider form needs to know whether to warn before
-- the user fills in a long form. There is nothing sensitive in the row.
drop policy if exists market_enforcement_read on public.market_enforcement;
create policy market_enforcement_read on public.market_enforcement
  for select using (true);

drop policy if exists market_enforcement_admin_write on public.market_enforcement;
create policy market_enforcement_admin_write on public.market_enforcement
  for all using (public.is_admin()) with check (public.is_admin());


-- ============================================================================
-- 2. THE TRIGGER
--
-- Runs BEFORE INSERT, and BEFORE UPDATE only when location_id changes.
--
-- Reads the service from the table's own `category` column where one exists,
-- falling back to a per-table default. That keeps service-level rules working
-- without the trigger needing to know anything table-specific.
-- ============================================================================
create or replace function public.enforce_area_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cfg       record;
  v_service text;
  v_area    text;
  ok        boolean;
begin
  select * into cfg from public.market_enforcement where id;

  -- Master switch. Absent row is treated as OFF, never as ON.
  if cfg is null or not cfg.enforce_enabled then
    return new;
  end if;

  -- On UPDATE, only care when the listing MOVES. Editing a price or a photo
  -- in a closed area must keep working — closing an area stops new supply,
  -- it does not freeze the business that is already there.
  if tg_op = 'UPDATE' and new.location_id is not distinct from old.location_id then
    return new;
  end if;

  /* ---- No area on the row ---- */
  if new.location_id is null then
    if cfg.require_location_id then
      raise exception 'A location is required for new listings.'
        using errcode = 'check_violation',
              hint    = 'Choose an area from the location list.';
    end if;
    -- Default: allow. Most existing rows have no location_id yet, and
    -- rejecting them would stop every provider on the platform.
    return new;
  end if;

  /* ---- Which service is this? ---- */
  begin
    v_service := to_jsonb(new) ->> 'category';
  exception when others then
    v_service := null;
  end;

  -- Fall back to a sensible service per table so service-level overrides
  -- still apply on tables that have no category column.
  if v_service is null or v_service = '' then
    v_service := case tg_table_name
      when 'hotels'              then 'hotels'
      when 'homestays'           then 'homestays'
      when 'hostels'             then 'hostels'
      when 'restaurants'         then 'restaurants'
      when 'activities'          then 'activities'
      when 'tour_companies'      then 'travel-companies'
      when 'tour_packages'       then 'tours'
      when 'tour_guides'         then 'guides'
      when 'transport_providers' then 'transport'
      when 'rental_vehicles'     then 'transport'
      when 'media_providers'     then 'photographers'
      when 'coworking_spaces'    then 'coworking'
      when 'roadside_providers'  then 'roadside'
      when 'events'              then 'events'
      else null
    end;
  end if;

  /* ---- Ask the one authority ---- */
  ok := public.resolve_location_flag(new.location_id, 'listings_enabled', v_service);

  if not ok then
    select name into v_area from public.locations where id = new.location_id;
    raise exception '%', coalesce(cfg.blocked_message, 'New listings are closed for this area.')
      using errcode = 'check_violation',
            detail  = coalesce(v_area, 'this area') || ' / ' || coalesce(v_service, 'this service'),
            hint    = 'Area or service is closed to new listings.';
  end if;

  -- Also refuse an area that is switched off entirely.
  if not public.resolve_location_flag(new.location_id, 'is_active') then
    raise exception '%', coalesce(cfg.blocked_message, 'This area is not active.')
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

comment on function public.enforce_area_rules is
  'BEFORE INSERT/UPDATE guard. The only place area rules are actually enforced, because provider forms write to Supabase directly with the anon key and cannot be trusted to check anything.';


-- ============================================================================
-- 3. ATTACH — to every table that has a location_id column
--
-- Schema-aware. A table phase72 skipped is skipped here too, with a notice.
-- ============================================================================
do $$
declare
  t text;
  n int := 0;
  listing_tables text[] := array[
    'hotels','homestays','hostels','restaurants','activities','events',
    'tour_companies','tour_packages','tour_guides','transport_providers',
    'rental_vehicles','media_providers','coworking_spaces','roadside_providers'
  ];
begin
  foreach t in array listing_tables loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    if not exists (
      select 1 from information_schema.columns
       where table_schema='public' and table_name=t and column_name='location_id'
    ) then
      raise notice 'skip %: no location_id column', t;
      continue;
    end if;

    execute format('drop trigger if exists enforce_area_rules_trg on public.%I', t);
    execute format(
      'create trigger enforce_area_rules_trg
         before insert or update of location_id on public.%I
         for each row execute function public.enforce_area_rules()', t);
    n := n + 1;
    raise notice 'guard attached to public.%', t;
  end loop;

  raise notice '--------------------------------------------';
  raise notice 'Guards attached: %', n;
  raise notice 'Enforcement is OFF. Nothing changes until you turn it on.';
  raise notice '--------------------------------------------';
end $$;


-- ============================================================================
-- 3b. WHICH AREAS ARE OPEN — for the provider form's dropdown
--
-- The form needs "every area currently accepting listings for this service".
-- Resolving that one area at a time from the browser would be an RPC per row,
-- which is exactly the N+1 the brief warns about. One call, one answer.
--
-- It resolves through resolve_location_flag, the same function the trigger
-- uses, so the dropdown and the guard agree by construction rather than by
-- two implementations happening to match.
--
-- SECURITY: returns only public, active areas. It is readable by any signed-in
-- user because a provider filling in a form needs it; it exposes nothing more
-- than the public location list already does.
-- ============================================================================
create or replace function public.areas_open_for_listings(p_service text default null)
returns table (id uuid, name text, path text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select l.id, l.name, array_to_string(l.path_slugs, ' / ')
    from public.locations l
   where public.resolve_location_flag(l.id, 'is_active')
     and public.resolve_location_flag(l.id, 'is_public')
     and public.resolve_location_flag(l.id, 'listings_enabled', p_service)
   order by l.depth, l.display_order, l.name;
$$;

revoke all on function public.areas_open_for_listings(text) from public;
grant execute on function public.areas_open_for_listings(text) to authenticated, anon;


-- ============================================================================
-- 4. A DRY RUN YOU CAN TRUST
--
-- Which of the listings you ALREADY have would be refused if they were
-- submitted today? Run this before switching enforcement on. A non-zero
-- count is not necessarily wrong — but it tells you exactly which providers
-- would hit a wall, so nobody finds out by failing.
-- ============================================================================
create or replace function public.preview_area_enforcement()
returns table (
  source_table  text,
  area          text,
  service       text,
  would_block   bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  t text;
  listing_tables text[] := array[
    'hotels','homestays','hostels','restaurants','activities',
    'tour_companies','tour_guides','transport_providers',
    'media_providers','coworking_spaces'
  ];
begin
  if not (public.is_admin() or current_user in ('postgres','supabase_admin','service_role')) then
    raise exception 'admin only';
  end if;

  create temp table if not exists _pv(tbl text, area text, svc text, n bigint) on commit drop;
  delete from _pv;

  foreach t in array listing_tables loop
    if to_regclass('public.' || t) is null then continue; end if;
    if not exists (select 1 from information_schema.columns
                    where table_schema='public' and table_name=t and column_name='location_id')
    then continue; end if;

    execute format($q$
      insert into _pv(tbl, area, svc, n)
      select %L, l.name, coalesce(to_jsonb(x) ->> 'category', '(default)'), count(*)
        from public.%I x
        join public.locations l on l.id = x.location_id
       where x.location_id is not null
         and not public.resolve_location_flag(
               x.location_id, 'listings_enabled', to_jsonb(x) ->> 'category')
       group by l.name, to_jsonb(x) ->> 'category'
    $q$, t, t);
  end loop;

  return query select p.tbl, p.area, p.svc, p.n from _pv p order by p.n desc;
end $$;

revoke all on function public.preview_area_enforcement() from public;
grant execute on function public.preview_area_enforcement() to authenticated;

select * from public.preview_area_enforcement();


-- ============================================================================
-- 5. HOW MANY LISTINGS ARE ACTUALLY GOVERNED
--
-- Enforcement only bites on rows that HAVE an area. This is the honest number
-- for how much of the platform these rules currently cover.
-- ============================================================================
do $$
declare
  t text; total bigint; linked bigint;
  g_total bigint := 0; g_linked bigint := 0;
begin
  foreach t in array array[
    'hotels','homestays','hostels','restaurants','activities',
    'tour_companies','tour_guides','transport_providers',
    'media_providers','coworking_spaces'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;
    if not exists (select 1 from information_schema.columns
                    where table_schema='public' and table_name=t and column_name='location_id')
    then continue; end if;
    execute format('select count(*), count(location_id) from public.%I', t) into total, linked;
    g_total := g_total + total; g_linked := g_linked + linked;
  end loop;

  raise notice '--------------------------------------------';
  raise notice 'Listings with an area: % of %', g_linked, g_total;
  if g_linked < g_total then
    raise notice 'The other % are NOT governed by area rules.', g_total - g_linked;
    raise notice 'Run phase75 to link them before relying on enforcement.';
  end if;
  raise notice '--------------------------------------------';
end $$;


-- ============================================================================
-- 6. TURNING IT ON — in this order, not all at once
--
-- STEP 1. Read section 4. Fix anything you did not expect.
--
-- STEP 2. Enable rule checking for listings that have an area:
--
--     update public.market_enforcement set enforce_enabled = true;
--
--     Test: try creating a listing in an area where you have set
--     listings_enabled = false. It must be refused with your message.
--     Then edit an EXISTING listing in that same area — it must still save.
--
-- STEP 3. Only after phase75 backfill is complete AND the provider forms
--         send a location_id, require one:
--
--     update public.market_enforcement set require_location_id = true;
--
--     Until both of those are true this rejects every new listing on the
--     platform. Do not run it to "be safe" — it is the opposite of safe.
--
-- TO STOP EVERYTHING IMMEDIATELY, with no deploy:
--
--     update public.market_enforcement set enforce_enabled = false,
--                                          require_location_id = false;
-- ============================================================================


-- ============================================================================
-- ROLLBACK — removes the guard entirely
-- ============================================================================
/*
do $$
declare t text;
begin
  foreach t in array array[
    'hotels','homestays','hostels','restaurants','activities','events',
    'tour_companies','tour_packages','tour_guides','transport_providers',
    'rental_vehicles','media_providers','coworking_spaces','roadside_providers'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists enforce_area_rules_trg on public.%I', t);
    end if;
  end loop;
end $$;

drop function if exists public.preview_area_enforcement();
drop function if exists public.areas_open_for_listings(text);
drop function if exists public.enforce_area_rules();
drop table    if exists public.market_enforcement;
*/
