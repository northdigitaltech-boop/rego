/* ============================================================
 * READ ONLY. Nothing here changes anything.
 *
 * Attabad Lake, Baltit Fort, Karimabad and Gojal are showing as
 * top-level locations — siblings of Pakistan — when all four are
 * places inside Hunza.
 *
 * Before deciding whether to delete them or move them, this shows
 * what they are and what is already pointing at them. A location
 * with listings or coverage attached cannot simply be deleted:
 * most of those columns are ON DELETE RESTRICT, so the delete is
 * refused, and the ones that are not would leave silent orphans.
 *
 * Run the whole file. It returns two result sets.
 * ============================================================ */


/* ---- 1. What is sitting at the top level, and what is attached ---- */
select
  l.id,
  l.name,
  l.location_type,
  l.slug,
  l.is_active,
  l.is_public,

  /* Anything underneath it in the tree. */
  (select count(*) from public.locations c where c.parent_id = l.id) as places_under_it,

  /* Provider coverage — "we operate here". */
  (select count(*) from public.service_locations s where s.location_id = l.id)
    as coverage_rows,

  /* Listings filed against it, across the tables that carry location_id.
     Counted separately so a non-zero number tells you WHERE to look. */
  (select count(*) from public.hotels           h where h.location_id = l.id) as hotels,
  (select count(*) from public.tour_packages    t where t.location_id = l.id) as tour_packages,
  (select count(*) from public.tour_guides      g where g.location_id = l.id) as guides,
  (select count(*) from public.activities       a where a.location_id = l.id) as activities,
  (select count(*) from public.expedition_companies e where e.location_id = l.id) as expedition_companies,

  /* SEO written against it — deleting this loses an indexed page. */
  (select count(*) from public.location_seo se where se.location_id = l.id) as seo_rows

from public.locations l
where l.parent_id is null
order by l.location_type, l.name;


/* ---- 2. Where they SHOULD live, if you move them instead ----
 *
 * Hunza, so you have its id to hand. If this returns more than one
 * row, say so before moving anything — that would mean Hunza itself
 * is duplicated and the merge needs doing first.
 */
select
  id,
  name,
  location_type,
  slug,
  (select p.name from public.locations p where p.id = l.parent_id) as sits_under
from public.locations l
where lower(l.name) like '%hunza%'
order by l.location_type, l.name;
