-- ============================================================
-- REGO — Phase 45: Rego Map (smart interactive map for Gilgit-Baltistan)
-- Tables: map_places, map_categories, road_routes, road_alerts,
--         distance_chart, community_reports.
-- Map pins can LINK to an existing Rego service (hotel, restaurant, guide,
-- transport, roadside, photographer, activity, etc.) instead of duplicating
-- data — via linked_service_type / linked_service_id / linked_profile_url.
-- Security-first RLS (public read published / owner report / admin manage),
-- matching phase42/43. Requires phase29 (is_admin).
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

/* ---------------- Categories ---------------- */
create table if not exists public.map_categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  icon       text,            -- lucide icon key
  color      text,            -- hex / tailwind token
  status     text not null default 'active',
  created_at timestamptz default now()
);

/* ---------------- Places / pins ---------------- */
create table if not exists public.map_places (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  category             text not null,        -- category slug
  district             text,
  city                 text,
  latitude             double precision not null,
  longitude            double precision not null,
  description          text,
  photos               text[],
  contact_number       text,
  status               text not null default 'open',   -- open | closed | seasonal
  is_verified          boolean not null default false,
  -- link to existing Rego service (no duplication)
  is_linked_service    boolean not null default false,
  linked_service_type  text,     -- hotels | restaurants | guides | transport | roadside | photographers | activities | ...
  linked_service_id    text,
  linked_profile_url   text,
  source               text,
  published            boolean not null default true,   -- admin can hide
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);
create index if not exists map_places_category_idx on public.map_places (category);
create index if not exists map_places_district_idx on public.map_places (district);

/* ---------------- Roads / routes ---------------- */
create table if not exists public.road_routes (
  id             uuid primary key default gen_random_uuid(),
  road_name      text not null,
  start_point    text,
  end_point      text,
  distance_km    numeric,
  estimated_time text,
  road_type      text,       -- highway | metalled | jeep-track | unpaved
  difficulty     text,       -- easy | moderate | hard | extreme
  status         text not null default 'open', -- open | blocked | partial | risky | snow-blocked | clearance
  risk_level     text not null default 'low',  -- low | medium | high | critical
  -- optional polyline: [[lat,lng], ...] as jsonb
  path           jsonb,
  updated_at     timestamptz default now(),
  created_at     timestamptz default now()
);

/* ---------------- Road alerts ---------------- */
create table if not exists public.map_road_alerts (
  id                    uuid primary key default gen_random_uuid(),
  road_name             text,
  location              text,
  latitude              double precision,
  longitude             double precision,
  alert_type            text,     -- landslide | snowfall | flood | accident | traffic | construction | bridge | closed | reopened
  status                text not null default 'active',
  reason                text,
  description           text,
  source_name           text,
  expected_opening_time text,
  alert_level           text not null default 'medium', -- low | medium | high | critical
  is_danger_zone        boolean not null default false, -- doubles as danger-zone layer
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

/* ---------------- Distance chart ---------------- */
create table if not exists public.distance_chart (
  id             uuid primary key default gen_random_uuid(),
  from_location  text not null,
  to_location    text not null,
  distance_km    numeric,
  estimated_time text,
  road_type      text,
  difficulty     text,
  notes          text,
  created_at     timestamptz default now()
);

/* ---------------- Community reports ---------------- */
create table if not exists public.map_reports (
  id             uuid primary key default gen_random_uuid(),
  user_email     text not null,
  user_name      text,
  report_type    text,     -- road-blocked | road-open | landslide | snowfall | accident | traffic | bridge | rescue
  location_name  text,
  road_name      text,
  latitude       double precision,
  longitude      double precision,
  description    text,
  photo          text,
  video          text,
  status         text not null default 'pending', -- pending | verified | rejected
  admin_note     text,
  created_at     timestamptz default now()
);
create index if not exists map_reports_status_idx on public.map_reports (status);
create index if not exists map_reports_user_idx on public.map_reports (user_email);

/* ---------------- RLS ---------------- */

-- Public reference tables: everyone reads published; admin manages.
do $$
declare pol record; t text;
begin
  foreach t in array array['map_categories','map_places','road_routes','map_road_alerts','distance_chart'] loop
    execute format('alter table public.%I enable row level security', t);
    for pol in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;
    execute format('create policy "%s_read" on public.%I for select using (true)', t, t);
    execute format('create policy "%s_ins" on public.%I for insert with check (public.is_admin())', t, t);
    execute format('create policy "%s_upd" on public.%I for update using (public.is_admin()) with check (public.is_admin())', t, t);
    execute format('create policy "%s_del" on public.%I for delete using (public.is_admin())', t, t);
  end loop;
end $$;

-- Community reports: any signed-in user submits & sees own; admin sees/manages all.
do $$
declare pol record;
begin
  execute 'alter table public.map_reports enable row level security';
  for pol in select policyname from pg_policies where schemaname='public' and tablename='map_reports' loop
    execute format('drop policy if exists %I on public.map_reports', pol.policyname);
  end loop;
  create policy "mr_read" on public.map_reports for select
    using (status = 'verified' or user_email = auth.email() or public.is_admin());
  create policy "mr_insert" on public.map_reports for insert
    with check (user_email = auth.email());
  create policy "mr_update" on public.map_reports for update
    using (public.is_admin()) with check (public.is_admin());
  create policy "mr_delete" on public.map_reports for delete
    using (user_email = auth.email() or public.is_admin());
end $$;
