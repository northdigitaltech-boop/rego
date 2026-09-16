/* ============================================================
 * phase119 — remove the four orphan top-level places
 *
 * Attabad Lake, Baltit Fort, Karimabad and Gojal/Upper Hunza were
 * sitting as siblings of Pakistan instead of inside Hunza. They
 * are being removed at the owner's instruction; they will be
 * re-added properly, region → division → district → place,
 * through the admin.
 *
 * ---------------------------------------------------------------
 * IT REFUSES RATHER THAN DESTROYS
 *
 * Every one of these rows may have listings, provider coverage or
 * SEO pointing at it. A bare DELETE would either be blocked by
 * ON DELETE RESTRICT — noisily, mid-script, leaving the rest
 * unrun — or quietly orphan a listing whose location_id has no
 * foreign key behind it. Neither is acceptable on production data.
 *
 * So this checks each row first. Anything with a dependant is
 * SKIPPED and named in the output, and the rest are deleted. You
 * get a list of what went and what did not, and why.
 *
 * A place with a dependant is not a tidy-up problem — it is a
 * listing that would lose its location. Tell me which ones are
 * skipped and we move those instead.
 *
 * ---------------------------------------------------------------
 * ROLLBACK: none. A deleted location cannot be restored from this
 * file — the id is gone and anything that referenced it is gone
 * with it. Section 0 is a read-only preview. Run that first, and
 * take a Supabase backup before running section 1.
 * ============================================================ */


/* ============================================================
 * 0. PREVIEW — read-only. Run this on its own first.
 * ============================================================ */
select
  l.name,
  l.location_type,
  l.slug,
  (select count(*) from public.locations c where c.parent_id = l.id) as children,
  (select count(*) from public.service_locations s where s.location_id = l.id) as coverage,
  (select count(*) from public.location_seo se where se.location_id = l.id) as seo,
  case
    when exists (select 1 from public.locations c where c.parent_id = l.id)
      or exists (select 1 from public.service_locations s where s.location_id = l.id)
      or exists (select 1 from public.location_seo se where se.location_id = l.id)
    then 'WILL BE SKIPPED — something depends on it'
    else 'will be deleted'
  end as verdict
from public.locations l
where l.parent_id is null
  and l.location_type not in ('country', 'region')
order by l.name;


/* ============================================================
 * 1. THE DELETE. Run once you are happy with the preview.
 * ============================================================ */
do $$
declare
  r record;
  t text;
  n bigint;
  attached bigint;
  deleted int := 0;
  skipped int := 0;

  /* Every table that carries location_id, guarded per table so a name this
     database does not have is skipped rather than raising. Same list
     phase101 uses — kept identical on purpose: two lists that are supposed
     to match and drift apart is how a listing gets missed. */
  listing_tables text[] := array[
    'hotels','homestays','hostels','tour_companies','tour_packages','tour_guides',
    'transport_providers','transport_services','rental_vehicles','media_providers',
    'restaurants','activities','events','coworking_spaces','roadside_providers',
    'expedition_companies','expedition_professionals','destinations','stories'
  ];
begin
  for r in
    select id, name, location_type
      from public.locations
     where parent_id is null
       /* Countries and regions are the legitimate top of the tree. Only
          stray places are in scope — this cannot delete Pakistan. */
       and location_type not in ('country', 'region')
  loop
    attached := 0;

    /* ---- anything underneath it ---- */
    select count(*) into n from public.locations c where c.parent_id = r.id;
    attached := attached + n;

    /* ---- provider coverage ---- */
    if to_regclass('public.service_locations') is not null then
      select count(*) into n from public.service_locations s where s.location_id = r.id;
      attached := attached + n;
    end if;

    /* ---- SEO ---- */
    if to_regclass('public.location_seo') is not null then
      select count(*) into n from public.location_seo se where se.location_id = r.id;
      attached := attached + n;
    end if;

    if to_regclass('public.location_service_settings') is not null then
      select count(*) into n
        from public.location_service_settings ls where ls.location_id = r.id;
      attached := attached + n;
    end if;

    /* ---- listings ---- */
    foreach t in array listing_tables loop
      if to_regclass('public.' || t) is null then continue; end if;
      if not exists (
        select 1 from information_schema.columns
         where table_schema = 'public' and table_name = t and column_name = 'location_id'
      ) then continue; end if;

      execute format('select count(*) from public.%I where location_id = $1', t)
        into n using r.id;
      attached := attached + n;
    end loop;

    if attached > 0 then
      skipped := skipped + 1;
      raise notice
        'SKIPPED "%" (%) — % row(s) depend on it. Move it instead of deleting.',
        r.name, r.location_type, attached;
      continue;
    end if;

    delete from public.locations where id = r.id;
    deleted := deleted + 1;
    raise notice 'deleted "%" (%)', r.name, r.location_type;
  end loop;

  raise notice '--- % deleted, % skipped ---', deleted, skipped;
end $$;


/* ============================================================
 * 2. VERIFY — what is left at the top of the tree.
 *
 * Should be countries and regions only.
 * ============================================================ */
select name, location_type, slug
  from public.locations
 where parent_id is null
 order by location_type, name;
