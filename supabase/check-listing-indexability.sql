-- ============================================================
-- Which listings Google will be told to index, and which not.
--
-- Read-only. Changes nothing. Run it BEFORE deploying the
-- listing-SEO change to see exactly what it will do.
--
-- This mirrors listingIndexability() in src/lib/listing-seo.ts.
-- If you change the rule there, change it here too.
--
-- NOINDEX IS NOT HIDING. Every listing below stays live, linked
-- and bookable on Rego. NOINDEX only keeps it out of Google's
-- results until it has enough on it to be useful there.
--
-- A listing is INDEXED when it has ALL of:
--   name       3+ characters
--   location   not empty
--   photo      a real upload — not empty, not stock filler
--
-- short_description is REPORTED but does not block. The first
-- version required 80+ characters of description; run against
-- production it marked most real listings noindex, because a
-- hotel page also shows rooms, amenities, gallery and map from
-- other tables. A short description is worth improving, not a
-- reason to drop a real business out of Google.
--
-- Only approved listings are shown: anything else is never
-- indexed, and anonymous visitors cannot reach it anyway.
--
-- Every column below was checked against the migrations, scoped
-- to its own table. tour_guides, transports, media_providers and
-- restaurants call the label `name`; the rest call it `title`.
-- ============================================================

with listings as (
  -- Stays. The rule needs text, so it reads description from the row.
  select 'hotels' as source, id::text as id, title as name, location, image,
         description as body, 0 as facts
    from public.hotels where status = 'approved'
  union all
  select 'homestays', id::text, title, location, image, description, 0
    from public.homestays where status = 'approved'
  union all
  select 'hostels', id::text, title, location, image, description, 0
    from public.hostels where status = 'approved'

  union all
  select 'tour_companies', id::text, name, location,
         coalesce(nullif(cover_image, ''), logo), description, 0
    from public.tour_companies where status = 'approved'

  union all
  select 'tour_packages', id::text, title, coalesce(nullif(destination, ''), location),
         image, itinerary,
         (case when coalesce(trim(duration), '')         <> '' then 1 else 0 end
        + case when coalesce(trim(package_type), '')     <> '' then 1 else 0 end
        + case when coalesce(trim(difficulty_level), '') <> '' then 1 else 0 end)
    from public.tour_packages where status = 'approved'

  -- Vehicles: no description column exists, so their specs are the content.
  -- vehicle_number and driver_contact are deliberately not read.
  union all
  select 'transports', id::text, name, location, image, null,
         (case when coalesce(trim(vehicle_type), '')     <> '' then 1 else 0 end
        + case when coalesce(trim(model_year), '')       <> '' then 1 else 0 end
        + case when coalesce(trim(fuel_type), '')        <> '' then 1 else 0 end
        + case when coalesce(trim(transmission), '')     <> '' then 1 else 0 end
        + case when coalesce(trim(luggage_capacity), '') <> '' then 1 else 0 end)
    from public.transports where status = 'approved'

  union all
  select 'tour_guides', id::text, name, coalesce(nullif(city, ''), location), image, bio, 0
    from public.tour_guides where status = 'approved'

  union all
  select 'transport_services', id::text, title, location, image, description,
         case when coalesce(trim(vehicle_type), '') <> '' then 1 else 0 end
    from public.transport_services where status = 'approved'

  union all
  select 'rental_vehicles', id::text, title, location, image, description,
         case when coalesce(trim(vehicle_type), '') <> '' then 1 else 0 end
    from public.rental_vehicles where status = 'approved'

  union all
  select 'media_providers', id::text, name, coalesce(nullif(city, ''), location),
         coalesce(nullif(cover_image, ''), logo), bio, 0
    from public.media_providers where status = 'approved'

  union all
  select 'restaurants', id::text, name, coalesce(nullif(city, ''), location),
         coalesce(nullif(cover_image, ''), logo), description,
         case when coalesce(trim(address), '') <> '' then 1 else 0 end
    from public.restaurants where status = 'approved'
),
judged as (
  select
    source, id, name,
    array_remove(array[
      case when length(coalesce(trim(name), '')) < 3 then 'name' end,
      case when coalesce(trim(location), '') = '' then 'location' end,
      case when coalesce(trim(image), '') = ''
             or image ilike '%picsum.photos%'
             or image ilike '%loremflickr.com%'
             or image ilike '%pravatar.cc%'
             or image ilike '%placehold%'
             or image ilike '%source.unsplash.com%'
             or image ilike '%placekitten.com%'
           then 'photo' end,
      null
    ], null) as missing,
    /* Advisory only — mirrors listingIndexability(), where "content" is
       appended after the index decision is made. */
    (length(regexp_replace(coalesce(body, ''), '\s+', ' ', 'g')) < 80
       and facts < 3) as short_description
  from listings
)
select
  case when cardinality(missing) = 0 then 'INDEXED' else 'NOINDEX' end as verdict,
  source,
  name,
  array_to_string(missing, ', ')  as what_is_missing,
  case when short_description then 'yes' else '' end as short_description,
  id
from judged
order by verdict desc, source, name;

-- ------------------------------------------------------------
-- The same thing as one line per listing type, for a quick read.
-- Run this on its own if the full list is long.
-- ------------------------------------------------------------
-- (Copy the `with listings as (...), judged as (...)` block above,
--  then replace the final select with:)
--
-- select source,
--        count(*) filter (where cardinality(missing) = 0) as indexed,
--        count(*) filter (where cardinality(missing) > 0) as noindex,
--        count(*)                                         as total
--   from judged group by source order by source;
