/* ============================================================
 * Data-quality check — READ ONLY. Changes nothing.
 *
 * Run in Supabase → SQL Editor. Lists the listings a launch review
 * flagged, plus everything else of the same kind, so an admin can fix
 * them in the dashboard:
 *   1. prices above 0 and under PKR 500 (e.g. "Female drivers" PKR 15/day)
 *   2. names/descriptions with the known typos (Luckey, SHANGRILLA, Islamabd)
 *      and ALL-CAPS names
 *   3. descriptions that may not match the property ("19th-century" etc.)
 *   4. cover images that look like they belong to another page (flights,
 *      maps, world maps) — e.g. the Saizgar hotel showing a world-map image
 *   5. tour packages with no itinerary
 *
 * Each section is a separate result; the Supabase editor shows the last
 * one, so run them one at a time (select a block, then Run).
 * ============================================================ */

-- 1. Implausibly low prices ------------------------------------------------
select 'transport_services' as tbl, id, title as name, price_per_day as price, status
  from public.transport_services where price_per_day > 0 and price_per_day < 500
union all
select 'rental_vehicles', id, title, price_per_day, status
  from public.rental_vehicles where price_per_day > 0 and price_per_day < 500
union all
select 'tour_packages', id, title, price_per_person, status
  from public.tour_packages where price_per_person > 0 and price_per_person < 500
union all
select 'hotels', id, title, price, status
  from public.hotels where price > 0 and price < 500
order by price;

-- 2. Known typos and ALL-CAPS names ---------------------------------------
select 'hotels' as tbl, id, title as name, location from public.hotels
 where title ~* '(luckey|shangrilla|islamabd)' or location ~* 'islamabd'
    or (title = upper(title) and length(title) > 4)
union all
select 'homestays', id, title, location from public.homestays
 where title ~* '(luckey|shangrilla|islamabd)' or location ~* 'islamabd'
    or (title = upper(title) and length(title) > 4)
union all
select 'tour_packages', id, title, location from public.tour_packages
 where title ~* '(luckey|shangrilla|islamabd)' or coalesce(itinerary,'') ~* 'islamabd'
union all
select 'transport_services', id, title, null from public.transport_services
 where title ~* '(luckey|shangrilla|islamabd)';

-- 3. Descriptions to re-read against the photos ---------------------------
select 'hotels' as tbl, id, title, left(description, 160) as description_start
  from public.hotels
 where description ~* '(1[0-9]th[- ]century|centuries[- ]old|heritage mansion|ancient)';

-- 4. Cover images that look borrowed from another page --------------------
select 'hotels' as tbl, id, title, image from public.hotels
 where image ~* '(flight|plane|airport|world[-_ ]?map|worldmap|/map)'
union all
select 'homestays', id, title, image from public.homestays
 where image ~* '(flight|plane|airport|world[-_ ]?map|worldmap|/map)'
union all
select 'hostels', id, title, image from public.hostels
 where image ~* '(flight|plane|airport|world[-_ ]?map|worldmap|/map)';

-- 5. Tour packages with no (or a one-line) itinerary ----------------------
select id, title, price_per_person, status, length(coalesce(itinerary,'')) as itinerary_chars
  from public.tour_packages
 where length(coalesce(trim(itinerary),'')) < 40
 order by price_per_person desc;

-- 4b. The same cover photo used by different businesses -------------------
-- (Cloudinary URLs rarely contain words like "flight", so the check above
--  can miss a borrowed picture; a cover shared across owners is the other
--  tell-tale sign.)
with covers as (
  select 'hotels' as tbl, id, title, owner_email, image from public.hotels
  union all select 'homestays', id, title, owner_email, image from public.homestays
  union all select 'hostels', id, title, owner_email, image from public.hostels
)
select c.*
  from covers c
 where c.image is not null and c.image <> ''
   and exists (
     select 1 from covers d
      where d.image = c.image
        and coalesce(d.owner_email,'') <> coalesce(c.owner_email,'')
   )
 order by c.image;
