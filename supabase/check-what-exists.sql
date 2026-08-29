-- ============================================================================
-- Which migrations have actually run?
-- ============================================================================
--
-- READ-ONLY. Creates nothing, changes nothing.
--
-- Run this when a migration errors with "relation does not exist", or when
-- something on the site behaves as though a feature is missing. It answers the
-- one question worth answering first: what is actually in this database?
--
-- ONE STATEMENT, ON PURPOSE
--   The Supabase SQL editor displays only the LAST result set of a script and
--   never displays `raise notice` at all. An earlier version of this file was
--   three statements and a DO block, so two thirds of its answer was silently
--   thrown away — which reads as "checked, nothing there" rather than as a
--   missing result. Everything below is one SELECT.
--
--   Checks that need a table name held in a string use query_to_xml, which is
--   how to do that without leaving plain SQL.
-- ============================================================================

with expected(sort_key, phase, feature, kind, target) as (
  values
    -- Migrations that create a table: presence of the table is the test.
    (1, 'phase5',  'Bookings',                      'table',  'public.bookings'),
    (1, 'phase7',  'Reviews',                       'table',  'public.reviews'),
    (1, 'phase9',  'Rooms and inventory',           'table',  'public.rooms'),
    (1, 'phase10', 'Destinations',                  'table',  'public.destinations'),
    (1, 'phase20', 'Media / photographer bookings', 'table',  'public.media_bookings'),
    (1, 'phase29', 'Auth profiles',                 'table',  'public.profiles'),
    (1, 'phase38', 'Owner CRM analytics',           'table',  'public.listing_analytics_events'),
    (1, 'phase51', 'Platform settings',             'table',  'public.platform_settings'),
    (1, 'phase51', 'Subscription plans',            'table',  'public.subscription_plans'),
    (1, 'phase59', 'Job applications',              'table',  'public.job_applications'),
    (1, 'phase60', 'Provider services',             'table',  'public.provider_services'),
    (1, 'phase64', 'Ad slides',                     'table',  'public.ad_slides'),
    (1, 'phase65', 'Destination attractions',       'table',  'public.destinations'),
    (1, 'phase72', 'Markets and areas',             'table',  'public.locations'),
    (1, 'phase79', 'Answers (AEO)',                 'table',  'public.answers'),
    (1, 'phase79', 'Answer audit log',              'table',  'public.answer_audit_logs'),
    (1, 'phase83', 'GeoNames reference',            'table',  'public.geo_reference'),
    (1, 'phase85', 'Blog and news',                 'table',  'public.blog_posts'),
    (1, 'phase87', 'Blog comments',                 'table',  'public.blog_comments'),
    (1, 'phase87', 'Blog likes',                    'table',  'public.blog_likes'),

    -- Migrations that add to an existing table, so no new table appears.
    (2, 'phase89', 'Hero image',            'column',     'platform_settings.hero_image_url'),
    (2, 'phase90', 'Hero image (phone)',    'column',     'platform_settings.hero_image_mobile_url'),
    (2, 'phase86', 'Blog author privacy',   'constraint', 'blog_posts_author_not_email'),

    -- Functions and policy sets.
    (3, 'phase29', 'is_admin() helper',     'function',   'public.is_admin()'),
    (3, 'phase30b','RLS lockdown, listings','policy',     'hotels|p_read'),
    (3, 'phase30b','RLS lockdown, bookings','policy',     'bookings|b_read'),
    (3, 'phase92', 'Content RLS',           'policy',     'about_content|w92_insert')
),
checked as (
  select
    e.*,
    case e.kind
      when 'table'    then to_regclass(e.target) is not null
      when 'function' then to_regprocedure(e.target) is not null
      when 'column'   then exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name  = split_part(e.target, '.', 1)
          and column_name = split_part(e.target, '.', 2))
      when 'constraint' then exists (
        select 1 from pg_constraint where conname = e.target)
      when 'policy'   then exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename  = split_part(e.target, '|', 1)
          and policyname = split_part(e.target, '|', 2))
    end as present
  from expected e
)
select
  phase,
  feature,
  case when present then 'yes' else 'NOT RUN' end as ran,
  -- Row counts only for tables that exist, so a missing table cannot abort
  -- the query. A table that exists but is empty is worth seeing: it usually
  -- means the migration ran and the content was never written.
  case when kind = 'table' and present then
    (xpath('/row/c/text()', query_to_xml(
      format('select count(*) as c from %s', target), false, true, '')))[1]::text
  else '—' end as rows,
  target as looked_for
from checked
order by sort_key, phase, feature;
