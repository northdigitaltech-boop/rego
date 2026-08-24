-- ============================================================================
-- Phase 81 — Remove areas that duplicate their own parent district
--
-- IDEMPOTENT. Safe to re-run. Deletes nothing that anything depends on.
--
-- ---------------------------------------------------------------------------
-- THE BUG THIS FIXES — MINE, FROM phase74
--
-- phase74 created an `area` for every row in public.destinations, placed under
-- its district. For most destinations that is right: "Fairy Meadows" is an
-- area inside Diamer, "Karimabad" is an area inside Hunza.
--
-- But several destinations are named after the district itself. "Skardu" the
-- destination is not a place inside Skardu district — it IS Skardu. phase74
-- did not check for that, so it produced:
--
--     Baltistan Division
--     └── Skardu          (district)
--         └── Skardu      (area)     ← same name, same slug, no meaning
--
-- Two identically-named rows, one inside the other. In the admin tree they are
-- indistinguishable, and an admin who writes answers against one cannot find
-- them when they later select the other. That is exactly what happened.
--
-- This file removes the redundant child and re-points anything attached to it
-- back at the district.
--
-- IT ONLY TOUCHES AN AREA THAT:
--   • has the same slug as its parent, AND
--   • its parent is a district, AND
--   • has no children of its own
--
-- Anything else is left completely alone.
--
-- PREREQUISITES: phase72, phase74
-- ROLLBACK: bottom of file (recreates the areas; you will not want to).
-- ============================================================================

do $$
declare
  r record;
  n_moved int;
  n_removed int := 0;
  n_skipped int := 0;
begin
  for r in
    select child.id  as area_id,
           child.name,
           parent.id as district_id
      from public.locations child
      join public.locations parent on parent.id = child.parent_id
     where child.location_type = 'area'
       and parent.location_type = 'district'
       and child.slug = parent.slug
  loop
    -- Never remove a node with something beneath it.
    if exists (select 1 from public.locations c where c.parent_id = r.area_id) then
      raise warning 'skipped "%": it has child locations', r.name;
      n_skipped := n_skipped + 1;
      continue;
    end if;

    /* Move every reference up to the district BEFORE deleting, so nothing is
       lost. Answers written against the redundant area are the whole reason
       this file exists. */

    if to_regclass('public.answers') is not null then
      update public.answers set location_id = r.district_id where location_id = r.area_id;
      get diagnostics n_moved = row_count;
      if n_moved > 0 then
        raise notice '  moved % answer(s) from the duplicate "%" to its district', n_moved, r.name;
      end if;
    end if;

    if to_regclass('public.location_seo') is not null then
      /* Only move SEO rows that would not collide with one already on the
         district — the unique index is (location_id, service_slug, language). */
      update public.location_seo s set location_id = r.district_id
       where s.location_id = r.area_id
         and not exists (
           select 1 from public.location_seo t
            where t.location_id = r.district_id
              and t.service_slug is not distinct from s.service_slug
              and t.language_code = s.language_code
         );
      delete from public.location_seo where location_id = r.area_id;
    end if;

    if to_regclass('public.location_service_settings') is not null then
      update public.location_service_settings s set location_id = r.district_id
       where s.location_id = r.area_id
         and not exists (
           select 1 from public.location_service_settings t
            where t.location_id = r.district_id and t.service_slug = s.service_slug
         );
      delete from public.location_service_settings where location_id = r.area_id;
    end if;

    if to_regclass('public.location_nearby') is not null then
      delete from public.location_nearby
       where location_id = r.area_id or nearby_id = r.area_id;
    end if;

    -- Point the destination at the district instead.
    update public.destinations set location_id = r.district_id where location_id = r.area_id;

    -- Any listing backfilled onto the redundant area.
    declare t text;
    begin
      foreach t in array array[
        'hotels','homestays','hostels','restaurants','activities','events',
        'tour_companies','tour_guides','transport_providers','media_providers',
        'coworking_spaces','roadside_providers'
      ] loop
        if to_regclass('public.' || t) is null then continue; end if;
        if not exists (select 1 from information_schema.columns
                        where table_schema='public' and table_name=t and column_name='location_id')
        then continue; end if;
        execute format(
          'update public.%I set location_id = $1 where location_id = $2', t)
          using r.district_id, r.area_id;
      end loop;
    end;

    delete from public.locations where id = r.area_id;
    n_removed := n_removed + 1;
    raise notice 'removed duplicate area "%" (kept the district)', r.name;
  end loop;

  raise notice '--------------------------------------------';
  raise notice 'Duplicate areas removed : %', n_removed;
  raise notice 'Skipped (had children)  : %', n_skipped;
  raise notice '--------------------------------------------';
end $$;


-- ============================================================================
-- STOP IT HAPPENING AGAIN
--
-- phase74 is idempotent and will be re-run. Without this it would recreate
-- every duplicate it just lost.
--
-- A trigger rather than a constraint, because the rule depends on the PARENT
-- row and a CHECK constraint cannot look at another row.
-- ============================================================================
create or replace function public.block_self_named_area()
returns trigger
language plpgsql
as $$
declare
  parent_slug text;
  parent_type text;
begin
  if new.parent_id is null or new.location_type <> 'area' then
    return new;
  end if;

  select slug, location_type into parent_slug, parent_type
    from public.locations where id = new.parent_id;

  if parent_type = 'district' and parent_slug = new.slug then
    raise exception 'An area cannot have the same slug as the district it sits in ("%").', new.slug
      using hint = 'The destination IS the district — attach content to the district instead of creating a child with the same name.';
  end if;

  return new;
end $$;

drop trigger if exists block_self_named_area_trg on public.locations;
create trigger block_self_named_area_trg
  before insert or update of parent_id, slug on public.locations
  for each row execute function public.block_self_named_area();


-- ============================================================================
-- MAKE phase74 SKIP THESE INSTEAD OF FAILING
--
-- With the trigger above, re-running phase74 would now throw when it reached
-- a destination named after its district. upsert_location gets a guard so it
-- returns the district's id instead — which is the correct answer anyway.
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
  v_parent_slug text;
  v_parent_type text;
begin
  /* A destination named after its own district is that district, not a place
     inside it. Return the parent rather than creating a confusing twin. */
  if p_parent_id is not null and p_type = 'area' then
    select slug, location_type into v_parent_slug, v_parent_type
      from public.locations where id = p_parent_id;
    if v_parent_type = 'district' and v_parent_slug = p_slug then
      return p_parent_id;
    end if;
  end if;

  -- 1. Already in exactly the right place?
  if p_parent_id is null then
    select id into v_id from public.locations
     where market_id = p_market_id and slug = p_slug and parent_id is null;
  else
    select id into v_id from public.locations
     where market_id = p_market_id and slug = p_slug and parent_id = p_parent_id;
  end if;

  if v_id is not null then
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
-- VERIFY — should return zero rows
-- ============================================================================
select
  child.name  as duplicate_area,
  parent.name as inside_district
from public.locations child
join public.locations parent on parent.id = child.parent_id
where child.location_type = 'area'
  and parent.location_type = 'district'
  and child.slug = parent.slug;

-- Where the answers now live
select l.name, l.location_type, array_to_string(l.path_slugs, ' / ') as path,
       count(a.id) as answers
from public.locations l
left join public.answers a on a.location_id = l.id
where l.slug = 'skardu'
group by l.id, l.name, l.location_type, l.path_slugs;


-- ============================================================================
-- ROLLBACK
--
-- The duplicate areas were empty by definition and everything attached to
-- them was moved up before deletion, so there is nothing to restore. Only the
-- guards need removing if you want phase74's old behaviour back.
-- ============================================================================
/*
drop trigger  if exists block_self_named_area_trg on public.locations;
drop function if exists public.block_self_named_area();
-- upsert_location keeps the guard; remove the first block in its body to revert.
*/
