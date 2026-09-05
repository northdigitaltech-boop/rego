/* ============================================================
 * phase102 — make sure all fourteen GB districts exist, one at a time
 *
 * IDEMPOTENT. Safe to re-run. Adds what is missing, moves what is
 * in the wrong place, deletes nothing.
 *
 * ---------------------------------------------------------------------------
 * WHY A THIRD FILE FOR THIS
 *
 * phase100 was meant to leave fourteen districts under three divisions. There
 * are twelve, and Roundu is one of the missing ones.
 *
 * The reason is a design fault of mine, not a mystery: phase100 does all
 * fourteen inside a single anonymous block. That block is one transaction, so
 * ONE failure anywhere — a slug already taken at that parent by a row of a
 * different type, most likely, since phase74 created area rows named after
 * places from the destinations table — rolls the whole thing back, or aborts
 * the loop after the districts it had already handled.
 *
 * (The word "block" rather than the literal syntax, deliberately: writing the
 * dollar-quote inside this comment is what makes a naive "start at the first
 * occurrence" extraction slice the file in the wrong place.)
 *
 * Either way the file reported what it had counted, not what survived. A
 * migration that does fourteen things in one transaction and reports success
 * from a variable is a migration that can lie.
 *
 * So this one handles each district in its own sub-block with its own
 * exception handler. One district failing now costs exactly that district,
 * and the final report says which — read from the DATABASE, not from a
 * counter.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT DOES NOT DO
 *
 * It does not touch a row of any other type that happens to share a slug.
 * If "Roundu" already exists as an `area` under some district, that row is
 * left exactly as it is and a district Roundu is created under Baltistan
 * Division beside it. Merging the two is a judgement about whether they are
 * the same place, and phase101 exists because I made that judgement
 * automatically once already.
 *
 * ROLLBACK: at the bottom.
 * ============================================================ */

do $$
declare
  m_pk uuid;
  l_gb uuid;
  div_ids jsonb;
  r record;
  div_id uuid;
  existing_id uuid;
  existing_parent uuid;
  intended jsonb := '[
    {"slug":"skardu",      "name":"Skardu",      "div":"baltistan-division"},
    {"slug":"shigar",      "name":"Shigar",      "div":"baltistan-division"},
    {"slug":"kharmang",    "name":"Kharmang",    "div":"baltistan-division"},
    {"slug":"ghanche",     "name":"Ghanche",     "div":"baltistan-division"},
    {"slug":"roundu",      "name":"Roundu",      "div":"baltistan-division"},
    {"slug":"gilgit",      "name":"Gilgit",      "div":"gilgit-division"},
    {"slug":"hunza",       "name":"Hunza",       "div":"gilgit-division"},
    {"slug":"nagar",       "name":"Nagar",       "div":"gilgit-division"},
    {"slug":"ghizer",      "name":"Ghizer",      "div":"gilgit-division"},
    {"slug":"gupis-yasin", "name":"Gupis-Yasin", "div":"gilgit-division"},
    {"slug":"diamer",      "name":"Diamer",      "div":"diamer-division"},
    {"slug":"astore",      "name":"Astore",      "div":"diamer-division"},
    {"slug":"darel",       "name":"Darel",       "div":"diamer-division"},
    {"slug":"tangir",      "name":"Tangir",      "div":"diamer-division"}
  ]'::jsonb;
begin
  select id into m_pk from public.markets where slug = 'pakistan';
  if m_pk is null then
    raise exception 'market "pakistan" is missing — run phase72 first.';
  end if;

  select id into l_gb from public.locations
   where market_id = m_pk and slug = 'gilgit-baltistan';
  if l_gb is null then
    raise exception 'Gilgit-Baltistan is missing — run phase74 first.';
  end if;

  /* The divisions must exist before anything can go under them. These three
     are safe to upsert: they were confirmed present in the last check. */
  perform public.upsert_location(m_pk, l_gb, 'division', 'Gilgit Division',    'gilgit-division',    35.92, 74.31, 1);
  perform public.upsert_location(m_pk, l_gb, 'division', 'Baltistan Division', 'baltistan-division', 35.30, 75.63, 2);
  perform public.upsert_location(m_pk, l_gb, 'division', 'Diamer Division',    'diamer-division',    35.42, 74.10, 3);

  select jsonb_object_agg(slug, id) into div_ids
    from public.locations
   where parent_id = l_gb and location_type = 'division';

  for r in select * from jsonb_to_recordset(intended)
                    as x(slug text, name text, div text)
  loop
    div_id := (div_ids ->> r.div)::uuid;
    if div_id is null then
      raise notice 'SKIPPED % — division "%" not found', r.name, r.div;
      continue;
    end if;

    /* Each district gets its own sub-transaction. An exception here rolls
       back only this one; the other thirteen keep whatever they achieved.
       This is the whole point of the file. */
    begin
      select id, parent_id into existing_id, existing_parent
        from public.locations
       where market_id = m_pk
         and slug = r.slug
         and location_type = 'district'
       order by created_at
       limit 1;

      if existing_id is null then
        /* Before creating one: does this place already exist under another
           type? phase74 turned every row of the destinations table into an
           `area`, and several of those are districts — Roundu is a district
           of Baltistan Division and also a destination page.

           That is why phase100 could not create Roundu. The unique index on
           (market_id, parent_id, slug) refuses a second "roundu" under the
           same parent, the insert raised, and because phase100 ran all
           fourteen in one transaction, that single clash took the rest with
           it.

           Promoting the existing row is right and creating a second one is
           wrong: the area may already carry listings, coverage and SEO, and
           two rows for one place is precisely the mess phase101 had to clean
           up. */
        select id, parent_id into existing_id, existing_parent
          from public.locations
         where market_id = m_pk
           and slug = r.slug
           and location_type in ('area', 'city', 'town', 'village')
         order by created_at
         limit 1;

        if existing_id is not null then
          update public.locations
             set location_type = 'district',
                 parent_id     = div_id,
                 name          = r.name,
                 updated_at    = now()
           where id = existing_id;
          raise notice 'promoted existing "%" to a district under %', r.name, r.div;
        else
          insert into public.locations
            (market_id, parent_id, location_type, name, slug, country_code, display_order)
          values
            (m_pk, div_id, 'district', r.name, r.slug, 'PK', 100);
          raise notice 'created %', r.name;
        end if;

      elsif existing_parent is distinct from div_id then
        update public.locations
           set parent_id = div_id, updated_at = now()
         where id = existing_id;
        raise notice 'moved % under %', r.name, r.div;
      end if;

    exception when others then
      /* Named, so the next run has somewhere to start rather than the same
         silence that produced this file. */
      raise notice 'FAILED % (%): %', r.name, r.slug, sqlerrm;
    end;
  end loop;
end $$;


/* The report, read from the database rather than from a counter that was
   incremented before anything was committed.

   Fourteen rows, each with a division, is right.
   The Supabase editor shows only the last result set, so this is last. */
with intended(slug, name) as (
  values ('skardu','Skardu'),('shigar','Shigar'),('kharmang','Kharmang'),
         ('ghanche','Ghanche'),('roundu','Roundu'),
         ('gilgit','Gilgit'),('hunza','Hunza'),('nagar','Nagar'),
         ('ghizer','Ghizer'),('gupis-yasin','Gupis-Yasin'),
         ('diamer','Diamer'),('astore','Astore'),('darel','Darel'),('tangir','Tangir')
)
select
  i.name                                              as district,
  coalesce(div.name, '** MISSING **')                 as division,
  coalesce(l.location_type, '-')                      as type,
  (select count(*) from public.locations c where c.parent_id = l.id) as places_inside
from intended i
left join public.locations l
       on l.slug = i.slug and l.location_type = 'district'
left join public.locations div on div.id = l.parent_id
order by div.name nulls first, i.name;


/* ------------------------------------------------------------------
 * ROLLBACK — removes only districts this file could have created, and
 * only those with nothing attached. A district that has since been
 * given towns, listings or coverage is left alone; ON DELETE RESTRICT
 * would refuse anyway.
 * ------------------------------------------------------------------ */
-- delete from public.locations l
--  where l.location_type = 'district'
--    and l.slug in ('roundu','darel','tangir','gupis-yasin','kharmang')
--    and not exists (select 1 from public.locations c where c.parent_id = l.id)
--    and not exists (select 1 from public.service_locations s where s.location_id = l.id);
