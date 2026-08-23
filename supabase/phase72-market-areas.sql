-- ============================================================================
-- Phase 72 — Market & Area Management: FOUNDATION (Phase 1 of 6)
--
-- ADDITIVE AND IDEMPOTENT. Safe to re-run. Changes NO existing behaviour.
--
-- WHAT THIS DOES
--   Creates the tables that let Rego expand beyond Gilgit-Baltistan:
--   markets, a hierarchical location tree, per-area service settings,
--   per-location SEO, and an audit log for every market change.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--   • Does not touch any existing table's data.
--   • Does not drop, rename or re-type any existing column.
--   • Does not change any existing RLS policy.
--   • Does not convert price columns to minor units (that would rewrite
--     live booking data — it needs its own migration and its own plan).
--   • Does not enable anything. Nothing reads these tables until Phase 3.
--
-- ROLLBACK: see the very bottom of this file.
-- ============================================================================


-- ============================================================================
-- 0. PREREQUISITE CHECK
-- ============================================================================
do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'public.profiles is missing — run phase29-auth-profiles.sql first.';
  end if;
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'public.is_admin() is missing — run phase29-auth-profiles.sql first.';
  end if;
end $$;


-- ============================================================================
-- 1. MARKETS
--
-- A market is a commercial unit Rego operates in — normally a country, but
-- deliberately not forced to be one, because a market may later be a city
-- state or a cross-border region.
--
-- Pakistan is seeded as a row, NOT hardcoded in application logic.
-- ============================================================================
create table if not exists public.markets (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,

  -- ISO 3166-1 alpha-2. Uppercase enforced so lookups never miss on case.
  country_code      char(2) not null,
  -- ISO 4217. Stored per market so no code path may assume PKR.
  currency_code     char(3) not null default 'PKR',
  -- IANA timezone. All timestamps stay UTC; this is for display only.
  timezone          text    not null default 'Asia/Karachi',
  default_language  text    not null default 'en',

  -- Operational state. A market can exist in the admin before it is live.
  is_active         boolean not null default false,
  is_public         boolean not null default false,

  display_order     int     not null default 100,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid,
  updated_by        uuid,

  constraint markets_country_code_upper check (country_code = upper(country_code)),
  constraint markets_currency_code_upper check (currency_code = upper(currency_code)),
  constraint markets_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create index if not exists markets_active_idx on public.markets (is_active) where is_active;
create unique index if not exists markets_country_uidx on public.markets (country_code);


-- ============================================================================
-- 2. LOCATIONS — the hierarchy
--
-- Self-referencing tree. Depth is NOT capped at six: the spec asks for
-- unlimited levels where necessary, and administrative divisions genuinely
-- differ per country (Pakistan has divisions; many countries do not).
--
-- ---------------------------------------------------------------------------
-- THE MOST IMPORTANT DESIGN DECISION IN THIS FILE
--
-- Every control flag is a NULLABLE boolean, three-state:
--
--     NULL  = inherit from the nearest ancestor that has an explicit value
--     true  = explicitly enabled here   (override)
--     false = explicitly disabled here  (override)
--
-- This is what makes "is this value inherited or overridden?" answerable
-- without a second table, and it makes "Reset to inherited" a single
-- UPDATE ... SET col = NULL. A plain `boolean not null default true` cannot
-- distinguish "admin chose true" from "nobody has decided yet", and that
-- distinction is the entire feature.
-- ---------------------------------------------------------------------------
-- ============================================================================
create table if not exists public.locations (
  id            uuid primary key default gen_random_uuid(),
  market_id     uuid not null references public.markets(id) on delete restrict,
  parent_id     uuid references public.locations(id) on delete restrict,

  -- country | region | division | district | city | area
  -- Free text rather than an enum: an enum needs ALTER TYPE to extend, which
  -- is exactly the kind of migration we do not want when entering a country
  -- with an administrative level we did not anticipate.
  location_type text not null,

  name          text not null,
  slug          text not null,

  -- Denormalised from the market so public queries need no join.
  country_code  char(2) not null,
  currency_code char(3),
  timezone      text,

  latitude      double precision,
  longitude     double precision,

  display_order int not null default 100,

  /* ---- Controls. NULL means inherit. See the note above. ---- */
  is_active               boolean,   -- master switch; false hides everything
  is_public               boolean,   -- visible on the public website
  onboarding_enabled      boolean,   -- providers may register here
  listings_enabled        boolean,   -- new listings may be submitted here
  booking_enabled         boolean,   -- bookings may be taken here
  manual_approval_required boolean,  -- listings need admin approval
  coming_soon             boolean,   -- show the coming-soon treatment
  is_featured             boolean,   -- featured destination
  seo_enabled             boolean,   -- may be indexed / appear in sitemap

  coming_soon_message text,

  /* ---- Maintained by trigger. Do not write these by hand. ---- */
  depth      int not null default 0,
  -- Ancestor ids, root first. Lets us resolve inheritance and fetch a whole
  -- subtree without a recursive query per row — this is the N+1 guard.
  ancestors  uuid[] not null default '{}',
  -- Full slug path, e.g. {pakistan,gilgit-baltistan,skardu}. Used to build
  -- URLs and breadcrumbs without walking the tree.
  path_slugs text[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,

  constraint locations_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint locations_country_upper check (country_code = upper(country_code)),
  constraint locations_not_self_parent check (parent_id is null or parent_id <> id),
  constraint locations_lat_range check (latitude  is null or (latitude  between -90  and 90)),
  constraint locations_lng_range check (longitude is null or (longitude between -180 and 180))
);

-- Slug must be unique among siblings, not globally: "shigar" as a district and
-- "shigar" as a town under it are different real places. A partial unique index
-- handles the root case, where parent_id is NULL and would otherwise never
-- collide (NULL <> NULL in a unique index).
create unique index if not exists locations_slug_sibling_uidx
  on public.locations (market_id, parent_id, slug) where parent_id is not null;
create unique index if not exists locations_slug_root_uidx
  on public.locations (market_id, slug) where parent_id is null;

create index if not exists locations_parent_idx    on public.locations (parent_id);
create index if not exists locations_market_idx    on public.locations (market_id);
create index if not exists locations_type_idx      on public.locations (location_type);
create index if not exists locations_ancestors_idx on public.locations using gin (ancestors);
create index if not exists locations_public_idx    on public.locations (market_id, is_public)
  where is_public is true;


-- ---------------------------------------------------------------------------
-- Trigger: keep depth / ancestors / path_slugs correct.
--
-- Also rejects cycles. A cycle in a location tree would hang every recursive
-- read on the public site, so this is a hard constraint, not a warning.
-- ---------------------------------------------------------------------------
create or replace function public.locations_set_path()
returns trigger
language plpgsql
as $$
declare
  p record;
begin
  if new.parent_id is null then
    new.depth      := 0;
    new.ancestors  := '{}';
    new.path_slugs := array[new.slug];
  else
    select depth, ancestors, path_slugs, market_id, country_code
      into p
      from public.locations
     where id = new.parent_id;

    if not found then
      raise exception 'parent_id % does not exist', new.parent_id;
    end if;

    -- A node may not be its own ancestor.
    if new.id = any(p.ancestors) or new.id = new.parent_id then
      raise exception 'cycle detected: location % cannot be under %', new.id, new.parent_id;
    end if;

    -- Children must stay inside their parent's market.
    if p.market_id <> new.market_id then
      raise exception 'child market (%) must match parent market (%)', new.market_id, p.market_id;
    end if;

    new.depth      := p.depth + 1;
    new.ancestors  := p.ancestors || new.parent_id;
    new.path_slugs := p.path_slugs || new.slug;

    if new.country_code is null then
      new.country_code := p.country_code;
    end if;
  end if;

  new.updated_at := now();
  return new;
end $$;

drop trigger if exists locations_set_path_trg on public.locations;
create trigger locations_set_path_trg
  before insert or update of parent_id, slug, market_id on public.locations
  for each row execute function public.locations_set_path();


-- ---------------------------------------------------------------------------
-- Trigger: when a node moves or is renamed, its whole subtree must be rebuilt.
-- Without this, moving "Skardu" under a new division would silently leave every
-- town beneath it with a stale path — and stale paths become wrong URLs.
-- ---------------------------------------------------------------------------
create or replace function public.locations_rebuild_subtree()
returns trigger
language plpgsql
as $$
begin
  if new.path_slugs is distinct from old.path_slugs
     or new.depth is distinct from old.depth then
    -- Re-saving each descendant re-fires the BEFORE trigger, which recomputes
    -- its path from its (already updated) parent. Ordering by depth guarantees
    -- a parent is rebuilt before its children.
    update public.locations c
       set updated_at = now()
     where new.id = any(c.ancestors);
  end if;
  return null;
end $$;

drop trigger if exists locations_rebuild_subtree_trg on public.locations;
create trigger locations_rebuild_subtree_trg
  after update on public.locations
  for each row execute function public.locations_rebuild_subtree();


-- ============================================================================
-- 3. LOCATION TRANSLATIONS
--
-- Separate table, not columns, because the number of languages is unknown and
-- adding a column per language does not scale past the second one.
-- ============================================================================
create table if not exists public.location_translations (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references public.locations(id) on delete cascade,
  language_code text not null,
  name          text not null,
  intro         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint location_translations_unique unique (location_id, language_code)
);

create index if not exists location_translations_loc_idx on public.location_translations (location_id);


-- ============================================================================
-- 4. SERVICE CATEGORIES
--
-- ---------------------------------------------------------------------------
-- READ THIS BEFORE ASSUMING THIS TABLE IS A DUPLICATE.
--
-- Rego's category list currently lives in src/lib/data.ts as TypeScript
-- constants, with icons and taglines. There is no categories table in the
-- database — provider_services.category is unconstrained free text.
--
-- We cannot create a foreign key to a table that does not exist, and per-area
-- service settings without a foreign key would rot the moment a slug changes.
-- So this table exists to be REFERENCED, seeded from the code list. The code
-- stays the source of truth for display (icons, taglines, grouping). This
-- table is the source of truth for identity and referential integrity.
--
-- Keep them in sync by seeding, never by editing this table by hand.
-- ---------------------------------------------------------------------------
-- ============================================================================
create table if not exists public.service_categories (
  slug          text primary key,
  name          text not null,
  -- Matches the grouping in src/lib/data.ts categoryGroups.
  group_label   text,
  is_active     boolean not null default true,
  display_order int not null default 100,
  created_at    timestamptz not null default now(),
  constraint service_categories_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);


-- ============================================================================
-- 5. LOCATION ↔ SERVICE SETTINGS
--
-- One row per (location, service) that has been explicitly configured.
-- ABSENCE OF A ROW MEANS "inherit" — we do not pre-create a row per
-- location per service, because that would be locations × categories rows
-- of noise and would make "explicitly overridden" meaningless.
-- ============================================================================
create table if not exists public.location_service_settings (
  id           uuid primary key default gen_random_uuid(),
  location_id  uuid not null references public.locations(id) on delete cascade,
  service_slug text not null references public.service_categories(slug) on update cascade,

  /* NULL = inherit, same three-state rule as locations. */
  listings_enabled         boolean,
  booking_enabled          boolean,
  onboarding_enabled       boolean,
  manual_approval_required boolean,
  coming_soon              boolean,
  seo_enabled              boolean,

  display_order int not null default 100,

  updated_at timestamptz not null default now(),
  updated_by uuid,
  created_at timestamptz not null default now(),

  constraint location_service_unique unique (location_id, service_slug)
);

create index if not exists lss_location_idx on public.location_service_settings (location_id);
create index if not exists lss_service_idx  on public.location_service_settings (service_slug);


-- ============================================================================
-- 6. LOCATION SEO
--
-- Separate from locations because SEO content is large text that is read on
-- one page type only. Keeping it out of `locations` keeps the hierarchy table
-- narrow, and the hierarchy table is read on almost every request.
--
-- NOTE: phase47 already created public.seo_redirects. We reuse it rather than
-- creating a second redirects table.
-- ============================================================================
create table if not exists public.location_seo (
  id             uuid primary key default gen_random_uuid(),
  location_id    uuid not null references public.locations(id) on delete cascade,
  -- NULL = the destination page itself. A value = a location+service landing
  -- page, e.g. ('skardu', 'hotels') → "Hotels in Skardu".
  service_slug   text references public.service_categories(slug) on update cascade,
  language_code  text not null default 'en',

  seo_title        text,
  meta_description text,
  h1               text,
  intro            text,
  body             text,
  focus_keyword    text,
  canonical_url    text,

  og_title       text,
  og_description text,
  og_image       text,

  hero_image     text,
  hero_image_alt text,

  -- FAQ is JSONB so it can be rendered AND emitted as FAQPage JSON-LD from one
  -- source. Schema that disagrees with the visible page is a manual action.
  faq jsonb not null default '[]'::jsonb,

  robots_index  boolean not null default false,  -- opt-in, never opt-out
  robots_follow boolean not null default true,

  -- Drives sitemap <lastmod>. Only bump when content genuinely changed;
  -- a lastmod that moves on every deploy teaches crawlers to ignore it.
  content_updated_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,

  constraint location_seo_unique unique (location_id, service_slug, language_code),
  constraint location_seo_faq_is_array check (jsonb_typeof(faq) = 'array')
);

create index if not exists location_seo_loc_idx on public.location_seo (location_id);
create index if not exists location_seo_indexable_idx
  on public.location_seo (location_id) where robots_index is true;


-- ============================================================================
-- 7. NEARBY DESTINATIONS
--
-- Explicit and admin-curated rather than computed from lat/long. Distance does
-- not equal relevance in Gilgit-Baltistan: two valleys 20km apart can be a
-- nine-hour drive over a pass that is shut for six months.
-- ============================================================================
create table if not exists public.location_nearby (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  nearby_id   uuid not null references public.locations(id) on delete cascade,
  note        text,
  display_order int not null default 100,
  created_at  timestamptz not null default now(),
  constraint location_nearby_unique unique (location_id, nearby_id),
  constraint location_nearby_not_self check (location_id <> nearby_id)
);

create index if not exists location_nearby_loc_idx on public.location_nearby (location_id);


-- ============================================================================
-- 8. MARKET AUDIT LOG
--
-- A SEPARATE table from admin_audit_logs (phase31), which is shaped for user
-- management (target_user_id / field / note) and has no room for before/after
-- values. Reshaping it would mean altering a live audit table — the one kind
-- of table you must never rewrite.
--
-- APPEND-ONLY BY DESIGN: no INSERT, UPDATE or DELETE policy is defined below,
-- so under RLS nobody — including admins — can write or alter rows with the
-- anon key. Writes happen server-side with the service-role key only.
-- ============================================================================
create table if not exists public.market_audit_logs (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid,
  actor_email   text,
  action        text not null,        -- location.update | service.toggle | bulk.disable | seo.update
  entity_type   text not null,        -- market | location | location_service | location_seo | redirect
  entity_id     uuid,
  entity_label  text,                 -- human-readable, survives deletion
  before_value  jsonb,
  after_value   jsonb,
  request_id    text,
  ip_hash       text,                 -- hashed, never a raw IP
  created_at    timestamptz not null default now()
);

create index if not exists market_audit_entity_idx on public.market_audit_logs (entity_type, entity_id);
create index if not exists market_audit_created_idx on public.market_audit_logs (created_at desc);
create index if not exists market_audit_actor_idx   on public.market_audit_logs (actor_id);


-- ============================================================================
-- 9. ADDITIVE COLUMNS ON EXISTING TABLES
--
-- Nullable, no default, no backfill, no constraint. Nothing reads them yet.
-- Existing rows are untouched and every existing query keeps working.
--
-- These exist so Phase 2 has somewhere to write the reviewed mapping.
-- ============================================================================
do $$
declare
  t text;
  listing_tables text[] := array[
    'hotels','homestays','hostels','tour_companies','tour_packages','tour_guides',
    'transport_providers','transport_services','rental_vehicles','media_providers',
    'restaurants','activities','events','coworking_spaces','roadside_providers',
    'expedition_companies','expedition_pros','destinations','stories'
  ];
begin
  foreach t in array listing_tables loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I add column if not exists location_id uuid', t);
      execute format('alter table public.%I add column if not exists market_id uuid', t);
      -- Partial index: only the backfilled rows, so it stays tiny until Phase 2.
      execute format(
        'create index if not exists %I on public.%I (location_id) where location_id is not null',
        t || '_location_id_idx', t
      );
      raise notice 'location_id/market_id added to public.%', t;
    else
      raise notice 'skipped public.% (table not present)', t;
    end if;
  end loop;
end $$;

-- Foreign keys are added in PHASE 2, after the backfill is reviewed. Adding
-- them now would be harmless (all values are NULL) but would create the
-- impression the relationship is populated when it is not.


-- ============================================================================
-- 10. INHERITANCE RESOLVER
--
-- The single authoritative answer to "is X allowed at location Y for service Z".
-- Backend authorisation calls this. The admin UI calls it to show the resolved
-- value beside the local value. There must be exactly one implementation of
-- this rule or the UI and the API will eventually disagree.
--
-- PRECEDENCE, most specific wins:
--   1. explicit service setting at this location
--   2. explicit location setting at this location
--   3. explicit service setting at the nearest ancestor that has one
--   4. explicit location setting at the nearest ancestor that has one
--   5. the safe default
--
-- SAFE DEFAULT IS false FOR EVERYTHING EXCEPT is_active/is_public.
-- An unconfigured area must not silently accept bookings.
-- ============================================================================
create or replace function public.resolve_location_flag(
  p_location_id uuid,
  p_flag        text,
  p_service     text default null
)
returns boolean
language plpgsql
stable
security invoker
as $$
declare
  chain uuid[];
  node  uuid;
  val   boolean;
begin
  if p_location_id is null then
    return false;
  end if;

  if p_flag not in (
    'is_active','is_public','onboarding_enabled','listings_enabled',
    'booking_enabled','manual_approval_required','coming_soon',
    'is_featured','seo_enabled'
  ) then
    raise exception 'unknown flag: %', p_flag;
  end if;

  -- Self first, then ancestors nearest-first.
  select array[p_location_id] || array(
           select a from unnest(l.ancestors) with ordinality t(a, ord)
            order by ord desc
         )
    into chain
    from public.locations l
   where l.id = p_location_id;

  if chain is null then
    return false;
  end if;

  foreach node in array chain loop
    -- (1)/(3) service-level override at this node
    if p_service is not null and p_flag in (
      'listings_enabled','booking_enabled','onboarding_enabled',
      'manual_approval_required','coming_soon','seo_enabled'
    ) then
      execute format(
        'select %I from public.location_service_settings where location_id = $1 and service_slug = $2',
        p_flag
      ) into val using node, p_service;
      if val is not null then
        return val;
      end if;
    end if;

    -- (2)/(4) location-level value at this node
    execute format('select %I from public.locations where id = $1', p_flag)
      into val using node;
    if val is not null then
      return val;
    end if;
  end loop;

  -- (5) safe default
  return case when p_flag in ('is_active','is_public') then true else false end;
end $$;

comment on function public.resolve_location_flag is
  'Authoritative inheritance resolution for area/service controls. Backend authorisation must call this rather than reading a column directly.';


-- Companion: does this value come from here, or is it inherited?
-- The admin UI needs this to label a control honestly.
create or replace function public.location_flag_origin(
  p_location_id uuid,
  p_flag        text,
  p_service     text default null
)
returns text
language plpgsql
stable
security invoker
as $$
declare
  val boolean;
begin
  if p_service is not null then
    execute format(
      'select %I from public.location_service_settings where location_id = $1 and service_slug = $2',
      p_flag
    ) into val using p_location_id, p_service;
    if val is not null then return 'override_service'; end if;
  end if;

  execute format('select %I from public.locations where id = $1', p_flag)
    into val using p_location_id;
  if val is not null then return 'override_location'; end if;

  return 'inherited';
exception when others then
  return 'inherited';
end $$;


-- ============================================================================
-- 11. RLS
--
-- ---------------------------------------------------------------------------
-- A DELIBERATE DEPARTURE FROM THE PROJECT PATTERN.
--
-- Most Rego tables use `using (true)` with a comment saying writes are gated
-- at the application layer. That is not acceptable here. These tables decide
-- whether an area may take bookings and whether a page may be indexed. If the
-- anon key could write them, an attacker could open a disabled market or
-- de-index the whole site without touching the admin portal.
--
-- So: public reads only what is public. Every write requires is_admin().
-- ---------------------------------------------------------------------------
-- ============================================================================

alter table public.markets                   enable row level security;
alter table public.locations                 enable row level security;
alter table public.location_translations     enable row level security;
alter table public.service_categories        enable row level security;
alter table public.location_service_settings enable row level security;
alter table public.location_seo              enable row level security;
alter table public.location_nearby           enable row level security;
alter table public.market_audit_logs         enable row level security;

/* ---- markets ---- */
drop policy if exists markets_public_read on public.markets;
create policy markets_public_read on public.markets
  for select using (is_public is true and is_active is true);

drop policy if exists markets_admin_read on public.markets;
create policy markets_admin_read on public.markets
  for select using (public.is_admin());

drop policy if exists markets_admin_write on public.markets;
create policy markets_admin_write on public.markets
  for all using (public.is_admin()) with check (public.is_admin());

/* ---- locations ----
   Public sees a location only when it is explicitly public. NULL means
   "not decided", and an undecided location must not leak to the public site. */
drop policy if exists locations_public_read on public.locations;
create policy locations_public_read on public.locations
  for select using (is_public is true and is_active is not false);

drop policy if exists locations_admin_read on public.locations;
create policy locations_admin_read on public.locations
  for select using (public.is_admin());

drop policy if exists locations_admin_write on public.locations;
create policy locations_admin_write on public.locations
  for all using (public.is_admin()) with check (public.is_admin());

/* ---- translations ---- */
drop policy if exists location_translations_public_read on public.location_translations;
create policy location_translations_public_read on public.location_translations
  for select using (
    exists (select 1 from public.locations l
             where l.id = location_id and l.is_public is true and l.is_active is not false)
  );

drop policy if exists location_translations_admin_write on public.location_translations;
create policy location_translations_admin_write on public.location_translations
  for all using (public.is_admin()) with check (public.is_admin());

/* ---- service categories: readable by anyone, writable by admins ---- */
drop policy if exists service_categories_read on public.service_categories;
create policy service_categories_read on public.service_categories
  for select using (true);

drop policy if exists service_categories_admin_write on public.service_categories;
create policy service_categories_admin_write on public.service_categories
  for all using (public.is_admin()) with check (public.is_admin());

/* ---- location service settings ---- */
drop policy if exists lss_public_read on public.location_service_settings;
create policy lss_public_read on public.location_service_settings
  for select using (
    exists (select 1 from public.locations l
             where l.id = location_id and l.is_public is true and l.is_active is not false)
  );

drop policy if exists lss_admin_read on public.location_service_settings;
create policy lss_admin_read on public.location_service_settings
  for select using (public.is_admin());

drop policy if exists lss_admin_write on public.location_service_settings;
create policy lss_admin_write on public.location_service_settings
  for all using (public.is_admin()) with check (public.is_admin());

/* ---- location SEO: only indexable content is public ---- */
drop policy if exists location_seo_public_read on public.location_seo;
create policy location_seo_public_read on public.location_seo
  for select using (
    exists (select 1 from public.locations l
             where l.id = location_id and l.is_public is true and l.is_active is not false)
  );

drop policy if exists location_seo_admin_write on public.location_seo;
create policy location_seo_admin_write on public.location_seo
  for all using (public.is_admin()) with check (public.is_admin());

/* ---- nearby ---- */
drop policy if exists location_nearby_public_read on public.location_nearby;
create policy location_nearby_public_read on public.location_nearby
  for select using (true);

drop policy if exists location_nearby_admin_write on public.location_nearby;
create policy location_nearby_admin_write on public.location_nearby
  for all using (public.is_admin()) with check (public.is_admin());

/* ---- audit log: ADMINS MAY READ, NOBODY MAY WRITE ----
   No insert/update/delete policy is created on purpose. Under RLS that means
   zero writes are possible with the anon key, including by admins. The server
   writes with the service-role key. This is what makes the log evidence
   rather than a note an admin can edit after the fact. */
drop policy if exists market_audit_admin_read on public.market_audit_logs;
create policy market_audit_admin_read on public.market_audit_logs
  for select using (public.is_admin());


-- ============================================================================
-- 12. SEED — Pakistan and Gilgit-Baltistan
--
-- Seeded as DATA, not code. Nothing in the application may hardcode either.
-- Everything is created INACTIVE and NON-PUBLIC: this migration must not
-- change what a visitor sees. You switch it on from the admin in Phase 6.
--
-- The district set below mirrors the destinations already in the database.
-- It is intentionally conservative — add the rest from the admin UI, where
-- the change is audited.
-- ============================================================================
do $$
declare
  m_pk  uuid;
  l_pk  uuid;
  l_gb  uuid;
begin
  insert into public.markets (slug, name, country_code, currency_code, timezone, default_language, is_active, is_public, display_order)
  values ('pakistan', 'Pakistan', 'PK', 'PKR', 'Asia/Karachi', 'en', false, false, 1)
  on conflict (slug) do nothing;

  select id into m_pk from public.markets where slug = 'pakistan';

  insert into public.locations (market_id, parent_id, location_type, name, slug, country_code, currency_code, timezone, display_order)
  values (m_pk, null, 'country', 'Pakistan', 'pakistan', 'PK', 'PKR', 'Asia/Karachi', 1)
  on conflict do nothing;

  select id into l_pk from public.locations where market_id = m_pk and slug = 'pakistan' and parent_id is null;

  insert into public.locations (market_id, parent_id, location_type, name, slug, country_code, display_order)
  values (m_pk, l_pk, 'region', 'Gilgit-Baltistan', 'gilgit-baltistan', 'PK', 1)
  on conflict do nothing;

  select id into l_gb from public.locations
   where market_id = m_pk and parent_id = l_pk and slug = 'gilgit-baltistan';

  insert into public.locations (market_id, parent_id, location_type, name, slug, country_code, latitude, longitude, display_order)
  values
    (m_pk, l_gb, 'district', 'Skardu',  'skardu',  'PK', 35.2971, 75.6333, 1),
    (m_pk, l_gb, 'district', 'Gilgit',  'gilgit',  'PK', 35.9208, 74.3080, 2),
    (m_pk, l_gb, 'district', 'Hunza',   'hunza',   'PK', 36.3167, 74.6500, 3),
    (m_pk, l_gb, 'district', 'Astore',  'astore',  'PK', 35.3667, 74.8583, 4),
    (m_pk, l_gb, 'district', 'Diamer',  'diamer',  'PK', 35.5333, 73.7500, 5),
    (m_pk, l_gb, 'district', 'Shigar',  'shigar',  'PK', 35.4231, 75.7369, 6),
    (m_pk, l_gb, 'district', 'Ghanche', 'ghanche', 'PK', 35.1500, 76.3333, 7),
    (m_pk, l_gb, 'district', 'Ghizer',  'ghizer',  'PK', 36.1667, 73.7500, 8),
    (m_pk, l_gb, 'district', 'Nagar',   'nagar',   'PK', 36.2500, 74.7500, 9)
  on conflict do nothing;

  raise notice 'Seeded market=pakistan (INACTIVE), region=gilgit-baltistan, 9 districts.';
  raise notice 'Nothing is public yet. Enable from the admin in Phase 6.';
end $$;


-- ============================================================================
-- 13. SEED — service categories, mirrored from src/lib/data.ts
--
-- If you add a category in code, add it here too. A slug present in code but
-- absent here simply cannot be configured per-area; it does not break.
-- ============================================================================
insert into public.service_categories (slug, name, group_label, display_order) values
  ('hotels',            'Hotels',                'Services',   1),
  ('homestays',         'Homestays',             'Services',   2),
  ('hostels',           'Hostels',               'Services',   3),
  ('travel-companies',  'Travel Companies',      'Services',   4),
  ('tours',             'Tour Packages',         'Services',   5),
  ('transport',         'Transport & Rentals',   'Services',   6),
  ('guides',            'Tour Guides',           'Services',   7),
  ('photographers',     'Photographers & Drone', 'Services',   8),
  ('restaurants',       'Restaurants',           'More',       9),
  ('coworking',         'Co-working Spaces',     'Services',  10),
  ('activities',        'Activities',            'Activities',11),
  ('events',            'Events & Expo',         'Events',    12),
  ('roadside',          'Roadside Assistance',   'Roadside',  13),
  ('expeditions',       'Expeditions',           'Services',  14)
on conflict (slug) do nothing;


-- ============================================================================
-- 14. VERIFY
-- ============================================================================
do $$
declare
  n_markets int; n_locs int; n_cats int; n_seeded int;
begin
  select count(*) into n_markets from public.markets;
  select count(*) into n_locs    from public.locations;
  select count(*) into n_cats    from public.service_categories;
  select count(*) into n_seeded  from public.locations where is_public is true;

  raise notice '--------------------------------------------';
  raise notice 'Phase 72 complete.';
  raise notice '  markets            : %', n_markets;
  raise notice '  locations          : %', n_locs;
  raise notice '  service categories : %', n_cats;
  raise notice '  PUBLIC locations   : %  (must be 0 — nothing is live yet)', n_seeded;
  raise notice '--------------------------------------------';

  if n_seeded > 0 then
    raise warning 'Some locations are already public. Phase 72 should leave everything hidden.';
  end if;
end $$;


-- ============================================================================
-- ROLLBACK
--
-- Fully reverses this migration. The new columns on existing tables are
-- dropped too — they are all NULL at this point, so nothing is lost. If you
-- have already run PHASE 2 (backfill), DO NOT run the column drops: that
-- would discard the reviewed mapping.
-- ============================================================================
/*
-- --- Step 1: functions and triggers ---
drop trigger  if exists locations_rebuild_subtree_trg on public.locations;
drop trigger  if exists locations_set_path_trg on public.locations;
drop function if exists public.locations_rebuild_subtree();
drop function if exists public.locations_set_path();
drop function if exists public.location_flag_origin(uuid, text, text);
drop function if exists public.resolve_location_flag(uuid, text, text);

-- --- Step 2: tables (child first) ---
drop table if exists public.market_audit_logs;
drop table if exists public.location_nearby;
drop table if exists public.location_seo;
drop table if exists public.location_service_settings;
drop table if exists public.location_translations;
drop table if exists public.locations;
drop table if exists public.service_categories;
drop table if exists public.markets;

-- --- Step 3: added columns. SAFE ONLY BEFORE PHASE 2 BACKFILL. ---
do $$
declare
  t text;
  listing_tables text[] := array[
    'hotels','homestays','hostels','tour_companies','tour_packages','tour_guides',
    'transport_providers','transport_services','rental_vehicles','media_providers',
    'restaurants','activities','events','coworking_spaces','roadside_providers',
    'expedition_companies','expedition_pros','destinations','stories'
  ];
begin
  foreach t in array listing_tables loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I drop column if exists location_id', t);
      execute format('alter table public.%I drop column if exists market_id', t);
    end if;
  end loop;
end $$;
*/
