-- ============================================================
-- Which listings have no usable photo, and why.
--
-- Read-only. One table, no notices.
--
-- Since the "real photos only" change, a listing whose image
-- column holds a stock URL (picsum / loremflickr / pravatar)
-- renders the "No photo yet" panel instead. Those URLs were
-- written automatically by the provider dashboards whenever
-- somebody left the image field blank, so they were never a
-- photograph of anything.
--
-- verdict tells you which case each row is:
--
--   NEVER UPLOADED  — the column is empty. The provider did not
--                     add a photo. Nothing is broken; ask them
--                     for one.
--   STOCK FILLER    — the column holds an auto-generated stock
--                     URL from before the change. Also not a
--                     photo of their business. Ask them for one,
--                     and the column can be cleared.
--   HAS PHOTO       — a real uploaded image. If one of these is
--                     showing the placeholder on the site, THAT
--                     is a bug — send me the row.
-- ============================================================

/* The label column is NOT the same in every table: tour_guides and
   transports call it `name`, the rest call it `title`. Getting this
   wrong is what made the first version of this file fail in the SQL
   editor with 42703 "column title does not exist" — the aliases below
   were checked against the migrations rather than assumed. */
with all_listings as (
  select 'tour_packages'      as source, id::text as id, title as name, image, owner_email from public.tour_packages
  union all
  select 'transports',             id::text, name,       image, owner_email from public.transports
  union all
  select 'tour_guides',            id::text, name,       image, owner_email from public.tour_guides
  union all
  select 'hotels',                 id::text, title,      image, owner_email from public.hotels
  union all
  select 'homestays',              id::text, title,      image, owner_email from public.homestays
  union all
  select 'hostels',                id::text, title,      image, owner_email from public.hostels
  union all
  select 'transport_services',     id::text, title,      image, owner_email from public.transport_services
  union all
  select 'rental_vehicles',        id::text, title,      image, owner_email from public.rental_vehicles
)
select
  case
    when coalesce(trim(image), '') = ''                              then 'NEVER UPLOADED'
    when image ilike '%picsum.photos%'
      or image ilike '%loremflickr.com%'
      or image ilike '%pravatar.cc%'
      or image ilike '%placehold%'                                   then 'STOCK FILLER'
    else                                                                  'HAS PHOTO'
  end                        as verdict,
  source,
  name,
  owner_email,
  left(coalesce(image, '(null)'), 90) as image_value,
  id
from all_listings
where coalesce(trim(image), '') = ''
   or image ilike '%picsum.photos%'
   or image ilike '%loremflickr.com%'
   or image ilike '%pravatar.cc%'
   or image ilike '%placehold%'
order by verdict, source, name;

-- ------------------------------------------------------------
-- Optional tidy-up, once you have the list above.
--
-- Clearing a stock URL changes nothing on the site — it already
-- renders as "No photo yet" either way. It just stops the fake
-- URL sitting in the database looking like real data, and makes
-- "has this provider uploaded a photo?" answerable with a plain
-- `image is null` check.
--
-- ROLLBACK: there isn't one, because the values being discarded
-- are randomly generated placeholders with no meaning. If that
-- makes you uneasy, run the SELECT above and save the output
-- first.
-- ------------------------------------------------------------

-- update public.tour_packages      set image = null where image ilike '%picsum.photos%' or image ilike '%loremflickr.com%';
-- update public.transports         set image = null where image ilike '%picsum.photos%' or image ilike '%loremflickr.com%';
-- update public.tour_guides        set image = null where image ilike '%pravatar.cc%'   or image ilike '%picsum.photos%';
-- update public.hotels             set image = null where image ilike '%picsum.photos%' or image ilike '%loremflickr.com%';
-- update public.homestays          set image = null where image ilike '%picsum.photos%' or image ilike '%loremflickr.com%';
-- update public.hostels            set image = null where image ilike '%picsum.photos%' or image ilike '%loremflickr.com%';
-- update public.transport_services set image = null where image ilike '%picsum.photos%' or image ilike '%loremflickr.com%';
-- update public.rental_vehicles    set image = null where image ilike '%picsum.photos%' or image ilike '%loremflickr.com%';
