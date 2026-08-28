-- ============================================================================
-- Which migrations have actually run?
-- ============================================================================
--
-- Read-only. Creates nothing, changes nothing.
--
-- Run this when a migration errors with "relation does not exist", or when
-- something on the site behaves as though a feature is missing. It answers
-- the one question worth answering first: what is actually in this database?
-- ============================================================================

select
  m.phase,
  m.feature,
  case when to_regclass(m.table_name) is null
       then '✗  NOT RUN'
       else '✓  present'
  end as status,
  m.table_name
from (values
  ('phase20',  'Media / photographer bookings', 'public.media_bookings'),
  ('phase51',  'Platform settings',             'public.platform_settings'),
  ('phase65',  'Destination attractions',       'public.destinations'),
  ('phase72',  'Markets and areas',             'public.locations'),
  ('phase79',  'Answers (AEO)',                 'public.answers'),
  ('phase79',  'Answer audit log',              'public.answer_audit_logs'),
  ('phase83',  'GeoNames reference',            'public.geo_reference'),
  ('phase85',  'Blog and news',                 'public.blog_posts'),
  ('phase87',  'Blog comments',                 'public.blog_comments'),
  ('phase87',  'Blog likes',                    'public.blog_likes')
) as m(phase, feature, table_name)
order by m.phase, m.feature;


-- ----------------------------------------------------------------------------
-- Columns added by the later migrations, which add to existing tables rather
-- than creating new ones — so the check above cannot see them.
-- ----------------------------------------------------------------------------
select
  'phase89' as phase, 'Hero image' as feature,
  case when exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'platform_settings'
       and column_name = 'hero_image_url'
  ) then '✓  present' else '✗  NOT RUN' end as status
union all
select
  'phase90', 'Hero image (phone)',
  case when exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'platform_settings'
       and column_name = 'hero_image_mobile_url'
  ) then '✓  present' else '✗  NOT RUN' end
union all
select
  'phase86', 'Blog author privacy',
  case when exists (
    select 1 from pg_constraint where conname = 'blog_posts_author_not_email'
  ) then '✓  present' else '✗  NOT RUN (or named differently)' end
order by phase;


-- ----------------------------------------------------------------------------
-- Where the Skardu questions on the live page are coming from.
--
-- There are two possible sources and they look identical to a visitor:
--   location_seo.faq  — the older per-location FAQ field
--   answers           — the governed system with verification and expiry
-- ----------------------------------------------------------------------------
-- Dynamic SQL is not decoration here. `case when to_regclass('public.answers')
-- is null then '…' else (select count(*) from public.answers) end` looks like
-- it guards the subquery and does not: Postgres resolves every table name at
-- parse time, before any branch is chosen, so a missing table takes down the
-- whole statement. That is exactly the case this section exists to report on.
do $$
declare
  txt text;
begin
  if to_regclass('public.location_seo') is null or to_regclass('public.locations') is null then
    raise notice 'location_seo.faq  →  table does not exist';
  else
    execute $q$
      select coalesce(jsonb_array_length(ls.faq)::text || ' question(s)', 'null faq')
      from public.location_seo ls
      join public.locations l on l.id = ls.location_id
      where l.slug = 'skardu' and ls.service_slug is null
      limit 1
    $q$ into txt;
    raise notice 'location_seo.faq  →  %', coalesce(txt, 'no row for skardu');
  end if;

  if to_regclass('public.answers') is null then
    raise notice 'answers table     →  does not exist, phase79 has not run';
  elsif to_regclass('public.locations') is null then
    raise notice 'answers table     →  exists, but locations does not';
  else
    execute $q$
      select count(*)::text || ' row(s) for skardu'
      from public.answers a
      join public.locations l on l.id = a.location_id
      where l.slug = 'skardu'
    $q$ into txt;
    raise notice 'answers table     →  %', txt;
  end if;
end $$;
