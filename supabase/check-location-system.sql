/* ============================================================
 * READ-ONLY. Changes nothing. Safe to run any time.
 *
 * Answers one question: is the centralised location system
 * actually in THIS database, or only in the repository?
 *
 * Every count goes through query_to_xml rather than being written
 * as a plain subquery, because Postgres resolves table names when
 * it parses the statement — before any CASE or guard runs. A
 * `case when to_regclass(...) is not null then (select count(*)
 * from t) end` reads as protective and is not: if t is missing,
 * the whole statement fails to parse. Dynamic SQL is the only way
 * to ask "how many rows, if this table exists at all".
 *
 * Run the whole file. The Supabase editor shows only the last
 * result set, so there is deliberately one.
 * ============================================================ */

with checks(sort_order, item, kind, obj, q) as (
  values
    (1,  'markets table',              'table', 'public.markets',
         $q$select count(*) from public.markets$q$),
    (2,  'locations table',            'table', 'public.locations',
         $q$select count(*) from public.locations$q$),
    (3,  '  regions/provinces',        'table', 'public.locations',
         $q$select count(*) from public.locations where location_type = 'region'$q$),
    (4,  '  divisions',                'table', 'public.locations',
         $q$select count(*) from public.locations where location_type = 'division'$q$),
    (5,  '  districts',                'table', 'public.locations',
         $q$select count(*) from public.locations where location_type = 'district'$q$),
    (6,  '  areas',                    'table', 'public.locations',
         $q$select count(*) from public.locations where location_type = 'area'$q$),
    (7,  'service_categories',         'table', 'public.service_categories',
         $q$select count(*) from public.service_categories$q$),
    (8,  'location_service_settings',  'table', 'public.location_service_settings',
         $q$select count(*) from public.location_service_settings$q$),
    (9,  'location_seo',               'table', 'public.location_seo',
         $q$select count(*) from public.location_seo$q$),
    (10, 'location_nearby',            'table', 'public.location_nearby',
         $q$select count(*) from public.location_nearby$q$),
    (11, 'market_audit_logs',          'table', 'public.market_audit_logs',
         $q$select count(*) from public.market_audit_logs$q$),
    (12, 'market_enforcement',         'table', 'public.market_enforcement',
         $q$select count(*) from public.market_enforcement$q$),

    /* phase75 — listings actually attached to a location. If these are 0 while
       the tree above is populated, the backfill never ran and the tree is
       decoration. */
    (20, 'hotels with an area',        'table', 'public.hotels',
         $q$select count(*) from public.hotels where location_id is not null$q$),
    (21, 'transport_services w/ area', 'table', 'public.transport_services',
         $q$select count(*) from public.transport_services where location_id is not null$q$),
    (22, 'tour_packages with an area', 'table', 'public.tour_packages',
         $q$select count(*) from public.tour_packages where location_id is not null$q$),
    (23, 'restaurants with an area',   'table', 'public.restaurants',
         $q$select count(*) from public.restaurants where location_id is not null$q$),

    /* phase95 — the column phase72's typo skipped. 0 here with a NULL count
       means the column exists; "missing" means phase95 has not been run. */
    (24, 'expedition_professionals.location_id', 'column',
         'public.expedition_professionals',
         $q$select count(*) from public.expedition_professionals where location_id is not null$q$)
)
select
  c.item,
  case
    when c.kind = 'column' and to_regclass(c.obj) is not null
         and not exists (
           select 1 from information_schema.columns
            where table_schema = 'public'
              and table_name   = split_part(c.obj, '.', 2)
              and column_name  = 'location_id'
         )
      then 'COLUMN MISSING - run phase95'
    when to_regclass(c.obj) is null
      then 'TABLE MISSING'
    else coalesce(
      (xpath('/row/c/text()',
             query_to_xml(replace(c.q, 'count(*)', 'count(*) as c'), false, true, '')
      ))[1]::text,
      '0')
  end as result
from checks c
order by c.sort_order;


/* ------------------------------------------------------------------
 * The part that matters most: what is PUBLIC right now.
 *
 * Uncomment and run separately. resolve_location_flag walks up the
 * tree for each NULL, so this is the answer the site itself would
 * get — not the raw column, which is NULL almost everywhere by
 * design.
 * ------------------------------------------------------------------ */
-- select
--   l.name,
--   l.location_type,
--   public.resolve_location_flag(l.id, 'is_active')          as active,
--   public.resolve_location_flag(l.id, 'is_public')          as public,
--   public.resolve_location_flag(l.id, 'listings_enabled')   as listings,
--   public.resolve_location_flag(l.id, 'booking_enabled')    as booking,
--   public.resolve_location_flag(l.id, 'seo_enabled')        as seo
-- from public.locations l
-- where l.location_type in ('country', 'region')
-- order by l.depth, l.display_order;


/* ------------------------------------------------------------------
 * What a provider form would offer today.
 *
 * If this returns nothing, the picker renders nothing and the
 * registration forms behave exactly as they did before — which is
 * the designed fallback, not a failure.
 * ------------------------------------------------------------------ */
-- select count(*) as areas_open_to_hotel_listings
--   from public.areas_open_for_listings('hotels');
