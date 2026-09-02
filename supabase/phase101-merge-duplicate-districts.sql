/* ============================================================
 * phase101 — merge the duplicate districts phase100 left behind
 *
 * IDEMPOTENT. Safe to re-run. Moves everything off a duplicate
 * before removing it, so nothing that points at one is lost.
 *
 * ---------------------------------------------------------------------------
 * MY MISTAKE, WRITTEN DOWN
 *
 * phase100 was supposed to put every district under its division. It looked
 * each one up like this:
 *
 *     select id, parent_id into existing_id, existing_parent
 *       from public.locations
 *      where slug = d_slug and location_type = 'district'
 *      order by created_at
 *      limit 1;
 *
 * `limit 1`. Where a slug had TWO rows — and several did, from phase72 and
 * phase74 both creating them — it moved the older one under the division and
 * left the newer one exactly where it was, directly under Gilgit-Baltistan.
 *
 * So the dropdown still shows districts beside divisions, and the count went
 * from "23 districts" to "12 things under the region": three divisions and
 * nine orphans. phase100 did half a job and reported success.
 *
 * ---------------------------------------------------------------------------
 * WHY MERGE AND NOT DELETE
 *
 * A duplicate is not necessarily empty. Either copy may have listings
 * attached, towns underneath it, or SEO written against it, because for months
 * both existed and different code paths found different ones. Deleting the
 * loser would take those with it — and ON DELETE RESTRICT would refuse
 * anyway, so a naive delete simply errors.
 *
 * So everything pointing at the duplicate is re-pointed at the keeper first,
 * and only then is the duplicate removed.
 *
 * THE KEEPER is the copy already sitting under a division: that is the one
 * phase100 placed deliberately, and the one the tree is meant to use.
 *
 * ROLLBACK: there isn't one, and that is stated rather than pretended. Merging
 * two rows into one destroys the information about which listing came from
 * which copy. Section 0 is a read-only preview — run it first, and take a
 * Supabase backup if the numbers are larger than you expect.
 * ============================================================ */


/* ============================================================
 * 0. PREVIEW — read-only. Run this on its own first.
 *
 * Every district still sitting directly under the region, what it
 * would merge into, and how much is attached to it.
 * ============================================================ */
select
  dup.name                                            as duplicate,
  dup.slug,
  keeper.name                                         as would_merge_into,
  coalesce(div.name, '(no keeper found — will be moved instead)') as keeper_sits_under,
  (select count(*) from public.locations c where c.parent_id = dup.id)      as places_under_duplicate,
  (select count(*) from public.service_locations s where s.location_id = dup.id) as coverage_rows
from public.locations dup
join public.locations gb   on gb.id = dup.parent_id and gb.slug = 'gilgit-baltistan'
left join public.locations keeper
       on keeper.slug = dup.slug
      and keeper.location_type = 'district'
      and keeper.id <> dup.id
      and keeper.parent_id in (
        select d.id from public.locations d
         where d.location_type = 'division' and d.parent_id = gb.id
      )
left join public.locations div on div.id = keeper.parent_id
where dup.location_type = 'district'
order by dup.name;


/* ============================================================
 * 1. THE MERGE. Run this block once you are happy with the preview.
 * ============================================================ */
do $$
declare
  gb_id uuid;
  r record;
  t text;
  n bigint;
  moved_children int := 0;
  merged int := 0;
  relocated int := 0;

  /* Same list phase72 uses, plus expedition_professionals, which its typo
     missed and phase95 added. Guarded per table, so a name that is not in
     this database is skipped rather than raising. */
  listing_tables text[] := array[
    'hotels','homestays','hostels','tour_companies','tour_packages','tour_guides',
    'transport_providers','transport_services','rental_vehicles','media_providers',
    'restaurants','activities','events','coworking_spaces','roadside_providers',
    'expedition_companies','expedition_professionals','destinations','stories'
  ];
begin
  select id into gb_id from public.locations where slug = 'gilgit-baltistan';
  if gb_id is null then
    raise exception 'Gilgit-Baltistan is missing — run phase74 first.';
  end if;

  for r in
    select dup.id as dup_id, dup.slug, dup.name, keeper.id as keeper_id
      from public.locations dup
      left join public.locations keeper
             on keeper.slug = dup.slug
            and keeper.location_type = 'district'
            and keeper.id <> dup.id
            and keeper.parent_id in (
              select d.id from public.locations d
               where d.location_type = 'division' and d.parent_id = gb_id
            )
     where dup.location_type = 'district'
       and dup.parent_id = gb_id
  loop

    /* No twin under a division: this one is simply unmoved, not a duplicate.
       Leave it alone here — phase100 re-run, or an admin, places it. Counting
       it so the notice at the end is honest about what was not handled. */
    if r.keeper_id is null then
      relocated := relocated + 1;
      raise notice 'no keeper for "%" (%) — left in place', r.name, r.slug;
      continue;
    end if;

    /* 1a. Towns and areas underneath the duplicate move to the keeper. The
           trigger rebuilds their paths; a unique-slug clash means the keeper
           already has that town, so the duplicate's copy is dropped after its
           own children are lifted — but that is a second-order case and this
           reports it rather than guessing. */
    begin
      update public.locations
         set parent_id = r.keeper_id
       where parent_id = r.dup_id;
      get diagnostics n = row_count;
      moved_children := moved_children + n;
    exception when unique_violation then
      raise notice 'places under "%" clash with the keeper — resolve by hand', r.name;
      continue;
    end;

    /* 1b. Every listing that points at the duplicate now points at the
           keeper. Done before the delete, because location_id has no foreign
           key on most of these and a silent orphan is worse than a loud
           failure. */
    foreach t in array listing_tables loop
      if to_regclass('public.' || t) is null then continue; end if;
      if not exists (
        select 1 from information_schema.columns
         where table_schema = 'public' and table_name = t and column_name = 'location_id'
      ) then continue; end if;

      execute format(
        'update public.%I set location_id = $1 where location_id = $2', t
      ) using r.keeper_id, r.dup_id;
    end loop;

    /* 1c. Coverage rows. The unique constraint means a provider who somehow
           has both copies would collide, so the duplicate's row is dropped
           when the keeper's already exists. */
    if to_regclass('public.service_locations') is not null then
      delete from public.service_locations d
       where d.location_id = r.dup_id
         and exists (
           select 1 from public.service_locations k
            where k.listing_table = d.listing_table
              and k.listing_id    = d.listing_id
              and k.location_id   = r.keeper_id
              and k.relation_type = d.relation_type
         );
      update public.service_locations
         set location_id = r.keeper_id
       where location_id = r.dup_id;
    end if;

    /* 1d. Per-location settings and SEO, if anything was written against the
           duplicate. Keeper wins where both exist. */
    if to_regclass('public.location_service_settings') is not null then
      delete from public.location_service_settings d
       where d.location_id = r.dup_id
         and exists (select 1 from public.location_service_settings k
                      where k.location_id = r.keeper_id
                        and k.service_slug = d.service_slug);
      update public.location_service_settings
         set location_id = r.keeper_id where location_id = r.dup_id;
    end if;

    if to_regclass('public.location_seo') is not null then
      delete from public.location_seo d
       where d.location_id = r.dup_id
         and exists (select 1 from public.location_seo k
                      where k.location_id = r.keeper_id
                        and k.language_code = d.language_code
                        and k.service_slug is not distinct from d.service_slug);
      update public.location_seo
         set location_id = r.keeper_id where location_id = r.dup_id;
    end if;

    if to_regclass('public.location_nearby') is not null then
      delete from public.location_nearby
       where location_id = r.dup_id or nearby_id = r.dup_id;
    end if;

    /* 1e. Nothing points at it now. */
    delete from public.locations where id = r.dup_id;
    merged := merged + 1;
    raise notice 'merged duplicate "%" into the copy under its division', r.name;
  end loop;

  raise notice 'phase101: merged %, moved % child places, left % with no keeper',
    merged, moved_children, relocated;
end $$;


/* ============================================================
 * 2. AFTERWARDS — run phase100 again.
 *
 * A district with no twin under a division is not a duplicate, only
 * unmoved, so this file leaves it exactly where it is: merging it into
 * nothing would mean deleting it, and deleting a district because it
 * was in the wrong place is not a repair.
 *
 * Once phase101 has removed the duplicates, every remaining district
 * has a unique slug — and phase100's `limit 1`, which is what caused
 * this in the first place, then has only one row to find. Running it a
 * second time moves the stragglers under their divisions and finishes
 * the job.
 * ============================================================ */


/* What is under the region now. Three divisions and nothing else is right;
   any district still listed here needs phase100 run again.
   The Supabase editor shows only the last result set, so this is last. */
select l.location_type, l.name
from public.locations l
join public.locations gb on gb.id = l.parent_id
where gb.slug = 'gilgit-baltistan'
order by l.location_type, l.name;
