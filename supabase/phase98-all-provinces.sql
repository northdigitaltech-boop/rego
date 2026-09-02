/* ============================================================
 * phase98 — the rest of Pakistan, and services that work nationwide
 *
 * ADDITIVE AND IDEMPOTENT. Safe to re-run.
 *
 * WHY
 *   Some Rego services are not tied to Gilgit-Baltistan. A tour
 *   guide, a travel company or a vehicle rental can be based in
 *   Lahore or Karachi and take travellers north. Those providers
 *   need somewhere to register, and until now Pakistan's tree
 *   held only Gilgit-Baltistan, Khyber Pakhtunkhwa and Azad
 *   Jammu & Kashmir.
 *
 * TWO SEPARATE STEPS, ON PURPOSE
 *   STEP 1 adds the missing provinces and territories. Purely
 *   structural — adding a place opens nothing.
 *
 *   STEP 2 opens three services across all of Pakistan. That is a
 *   business decision, not a structural one, so it is separated
 *   and has its own rollback. You can skip it entirely and do the
 *   same thing in Market & Area Management → Services, which is
 *   what that screen is for.
 *
 * ROLLBACK: after each step.
 * ============================================================ */


/* ============================================================
 * STEP 1 — the provinces and territories that were missing
 *
 * Gilgit-Baltistan, Khyber Pakhtunkhwa and Azad Jammu & Kashmir
 * already exist (phase74, phase96). This adds the other four.
 *
 * Coordinates are each unit's capital — Lahore, Karachi, Quetta,
 * and Islamabad itself. A province has no single point, so this
 * is the conventional marker rather than a computed centroid, and
 * it is only used to centre a map.
 *
 * Districts are NOT seeded. Pakistan has well over a hundred, and
 * guessing a hierarchy is exactly how phase74 came to exist —
 * phase72 had put nine districts directly under Gilgit-Baltistan
 * and missed that GB has three divisions in between. The admin
 * adds what is actually needed, in the tab.
 *
 * Every flag is left NULL. Adding a place does not open it: a
 * province appears in provider forms only once something resolves
 * listings_enabled to true for it, which is STEP 2's job.
 * ============================================================ */
do $$
declare
  m_pk uuid;
  l_pk uuid;
begin
  if to_regprocedure('public.upsert_location(uuid,uuid,text,text,text,double precision,double precision,int)') is null then
    raise exception 'public.upsert_location is missing — run phase74-gb-geography.sql first.';
  end if;

  select id into m_pk from public.markets where slug = 'pakistan';
  if m_pk is null then
    raise exception 'market "pakistan" is missing — run phase72-market-areas.sql first.';
  end if;

  select id into l_pk from public.locations
   where market_id = m_pk and slug = 'pakistan' and parent_id is null;
  if l_pk is null then
    raise exception 'the Pakistan country location is missing — run phase72 first.';
  end if;

  /* 1 Gilgit-Baltistan, 2 Khyber Pakhtunkhwa, 3 Azad Jammu & Kashmir already.
     Gilgit-Baltistan stays first because it is where Rego actually operates. */
  perform public.upsert_location(m_pk, l_pk, 'region', 'Punjab',      'punjab',      31.5204, 74.3587, 4);
  perform public.upsert_location(m_pk, l_pk, 'region', 'Sindh',       'sindh',       24.8607, 67.0011, 5);
  perform public.upsert_location(m_pk, l_pk, 'region', 'Balochistan', 'balochistan', 30.1798, 66.9750, 6);

  /* A federal territory, not a province. location_type is free text precisely
     so this does not need a new enum value; 'territory' says what it is. */
  perform public.upsert_location(m_pk, l_pk, 'territory', 'Islamabad Capital Territory', 'islamabad', 33.6844, 73.0479, 7);
end $$;

/* ------------------------------------------------------------------
 * STEP 1 ROLLBACK. parent_id is ON DELETE RESTRICT, so any of these
 * that has since been given a district will refuse to be deleted —
 * that is the safety net, not the plan. Check first.
 * ------------------------------------------------------------------ */
-- delete from public.locations
--  where slug in ('punjab', 'sindh', 'balochistan', 'islamabad')
--    and not exists (select 1 from public.locations c where c.parent_id = locations.id);


/* ============================================================
 * STEP 2 — three services, open across all of Pakistan
 *
 * OPTIONAL. Skip this and use Market & Area Management → Services
 * if you would rather click it.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS DOES NOT ALSO OPEN HOTELS EVERYWHERE
 *
 * resolve_location_flag walks from a location up to the country, and at EVERY
 * step it checks the per-service setting BEFORE the location's own value. So
 * a row here on Pakistan for service 'guides' answers "can a guide list in
 * Lahore?" — yes — while "can a hotel list in Lahore?" finds no guides row,
 * no location value on Punjab or Pakistan, and falls through to the default,
 * which for listings_enabled is false.
 *
 * Gilgit-Baltistan is unaffected either way: its own listings_enabled, set in
 * the admin, is found before the walk ever reaches Pakistan.
 *
 * That is the whole design working as intended — no code, no schema change,
 * two rows.
 * ---------------------------------------------------------------------------
 *
 * NOT INCLUDED: "solo traveller". Connect Solo Traveller is travellers
 * finding each other, not a provider listing, so it has no row in
 * service_categories and none of these flags apply to it. Nothing needs
 * doing for it to work outside Gilgit-Baltistan.
 * ============================================================ */
do $$
declare
  l_pk uuid;
  s    text;
  /* guides           — Tour Guides
     transport        — Transport & Rentals (this is "rentals")
     travel-companies — Travel Companies */
  services text[] := array['guides', 'transport', 'travel-companies'];
begin
  select l.id into l_pk
    from public.locations l
    join public.markets m on m.id = l.market_id
   where m.slug = 'pakistan' and l.slug = 'pakistan' and l.parent_id is null;

  if l_pk is null then
    raise exception 'the Pakistan country location is missing — run phase72 first.';
  end if;

  foreach s in array services loop
    if not exists (select 1 from public.service_categories where slug = s) then
      raise exception 'service category "%" does not exist — check service_categories.', s;
    end if;

    insert into public.location_service_settings (location_id, service_slug, listings_enabled)
    values (l_pk, s, true)
    on conflict (location_id, service_slug) do update
      /* Only fill a blank. If an admin has already decided this in the tab,
         their decision stands — a migration should not overrule a person. */
      set listings_enabled = coalesce(public.location_service_settings.listings_enabled, true);
  end loop;
end $$;

/* ------------------------------------------------------------------
 * STEP 2 ROLLBACK — closes those three services outside anywhere that
 * opens them in its own right. Gilgit-Baltistan is untouched.
 * ------------------------------------------------------------------ */
-- delete from public.location_service_settings
--  where service_slug in ('guides', 'transport', 'travel-companies')
--    and location_id = (
--      select l.id from public.locations l
--        join public.markets m on m.id = l.market_id
--       where m.slug = 'pakistan' and l.slug = 'pakistan' and l.parent_id is null
--    );


/* ============================================================
 * WHAT YOU SHOULD NOW SEE
 *
 * A guide registering from Punjab gets Punjab in the dropdown.
 * A hotel registering from Punjab does not.
 *
 * The Supabase editor shows only the last result set, so this is
 * deliberately the last statement.
 * ============================================================ */
select
  l.name                                                                as region,
  public.resolve_location_flag(l.id, 'listings_enabled', 'guides')      as guides,
  public.resolve_location_flag(l.id, 'listings_enabled', 'transport')   as rentals,
  public.resolve_location_flag(l.id, 'listings_enabled', 'travel-companies') as travel_companies,
  public.resolve_location_flag(l.id, 'listings_enabled', 'hotels')      as hotels,
  public.resolve_location_flag(l.id, 'listings_enabled', 'restaurants') as restaurants,
  (l.is_public is true and l.is_active is not false)                    as travellers_can_see
from public.locations l
join public.locations p on p.id = l.parent_id
where p.slug = 'pakistan'
order by l.display_order;
