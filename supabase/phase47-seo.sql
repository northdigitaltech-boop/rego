-- ============================================================================
-- Phase 47 — SEO foundation (ADDITIVE & IDEMPOTENT, safe to re-run)
--
-- Adds optional SEO fields to every public listing table, plus a redirects
-- table and a slug-history table for permanent 301s. Nothing here removes or
-- renames existing columns, and every field is nullable / defaulted so the app
-- keeps working for records that have no custom SEO data yet.
-- ============================================================================

-- 1) Add SEO columns to each public listing table --------------------------------
do $$
declare
  t text;
  seo_tables text[] := array[
    'hotels','homestays','tour_companies','tour_packages','tour_guides',
    'transport_providers','transport_services','rental_vehicles','media_providers',
    'restaurants','activities','events','stories','coworking_spaces',
    'roadside_providers','solo_travelers','destinations'
  ];
begin
  foreach t in array seo_tables loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I add column if not exists slug text', t);
      execute format('alter table public.%I add column if not exists seo_title text', t);
      execute format('alter table public.%I add column if not exists meta_description text', t);
      execute format('alter table public.%I add column if not exists canonical_url text', t);
      execute format('alter table public.%I add column if not exists og_title text', t);
      execute format('alter table public.%I add column if not exists og_description text', t);
      execute format('alter table public.%I add column if not exists og_image text', t);
      execute format('alter table public.%I add column if not exists robots_index boolean not null default true', t);
      execute format('alter table public.%I add column if not exists robots_follow boolean not null default true', t);
      execute format('alter table public.%I add column if not exists schema_type text', t);
      execute format('alter table public.%I add column if not exists in_sitemap boolean not null default true', t);
      -- Unique-per-table slug (nulls allowed so existing rows are unaffected).
      execute format('create unique index if not exists %I on public.%I (slug) where slug is not null', t || '_slug_uidx', t);
    end if;
  end loop;
end $$;

-- 2) Redirects table (301/302) ---------------------------------------------------
create table if not exists public.seo_redirects (
  id            uuid primary key default gen_random_uuid(),
  old_path      text not null unique,
  new_path      text not null,
  redirect_type smallint not null default 301,   -- 301 permanent, 302/307 temp
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists seo_redirects_active_idx on public.seo_redirects (active) where active;

-- 3) Slug history (so a changed published slug can 301 to the current URL) --------
create table if not exists public.slug_history (
  id         uuid primary key default gen_random_uuid(),
  entity     text not null,        -- table name, e.g. 'hotels'
  entity_id  uuid,                 -- record id (nullable for static pages)
  old_slug   text not null,
  new_slug   text not null,
  created_at timestamptz not null default now()
);
create index if not exists slug_history_lookup_idx on public.slug_history (entity, old_slug);

-- 4) RLS: redirects & slug history are public-readable, admin-writable ------------
alter table public.seo_redirects enable row level security;
alter table public.slug_history  enable row level security;

do $$
begin
  -- Public read (needed so a middleware/edge lookup can resolve redirects).
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='seo_redirects' and policyname='seo_redirects_read') then
    create policy seo_redirects_read on public.seo_redirects for select using (active);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='slug_history' and policyname='slug_history_read') then
    create policy slug_history_read on public.slug_history for select using (true);
  end if;

  -- Admin write (relies on public.is_admin() from phase29).
  if exists (select 1 from pg_proc where proname = 'is_admin') then
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='seo_redirects' and policyname='seo_redirects_admin_write') then
      create policy seo_redirects_admin_write on public.seo_redirects for all using (public.is_admin()) with check (public.is_admin());
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='slug_history' and policyname='slug_history_admin_write') then
      create policy slug_history_admin_write on public.slug_history for all using (public.is_admin()) with check (public.is_admin());
    end if;
  end if;
end $$;
