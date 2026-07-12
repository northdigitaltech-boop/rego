-- ============================================================
-- Phase 52 — Mountaineering & Expedition Services (Phase 1 schema)
--
-- Additive & idempotent. Mirrors the tour-companies + media patterns:
--   expedition_companies      (company profile)
--   expedition_professionals  (individual professional profile)
--   expedition_peaks / _routes / _roles  (admin-managed dynamic lists)
--
-- Private verification documents live in a `private_docs` jsonb column that
-- the data layer NEVER selects for public reads (see PUBLIC_* column lists).
-- RLS is permissive/app-gated to match the rest of the project (hotels,
-- tour_companies, etc.); phase30-style lockdown can scope later.
-- ============================================================

/* ---------------- admin-managed reference lists ---------------- */
create table if not exists public.expedition_roles (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  active        boolean not null default true,
  display_order int not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists public.expedition_peaks (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  region        text,
  height_m      int,
  active        boolean not null default true,
  display_order int not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists public.expedition_routes (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  region        text,
  active        boolean not null default true,
  display_order int not null default 0,
  created_at    timestamptz not null default now()
);

/* ---------------- expedition companies ---------------- */
create table if not exists public.expedition_companies (
  id                   uuid primary key default gen_random_uuid(),
  owner_email          text,
  name                 text not null,
  logo                 text,
  cover_image          text,
  description          text,
  year_established     int,
  reg_number           text,
  license_number       text,
  tourism_reg          text,
  address              text,
  city                 text,
  district             text,
  country              text default 'Pakistan',
  phone                text,
  whatsapp             text,
  email                text,
  website              text,
  socials              jsonb not null default '{}'::jsonb,
  languages            text[] default '{}',
  years_experience     int,
  expeditions_organized int,
  treks_organized      int,
  successful_count     int,
  peaks_handled        text[] default '{}',
  routes_handled       text[] default '{}',
  intl_clients         int,
  certifications       text[] default '{}',
  licenses             text[] default '{}',
  awards               text[] default '{}',
  insurance_info       text,
  safety_policy        text,
  rescue_capability    boolean not null default false,
  emergency_support    text,
  services             text[] default '{}',
  starting_price       numeric,
  currency             text default 'PKR',
  rating               numeric not null default 0,
  reviews              int not null default 0,
  gallery              text[] default '{}',
  -- private (never selected for public reads)
  private_docs         jsonb not null default '{}'::jsonb,
  verified             boolean not null default false,
  featured             boolean not null default false,
  status               text not null default 'pending',  -- pending | approved | rejected
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists expedition_companies_status_idx on public.expedition_companies (status);
create index if not exists expedition_companies_owner_idx  on public.expedition_companies (owner_email);

/* ---------------- individual professionals ---------------- */
create table if not exists public.expedition_professionals (
  id                    uuid primary key default gen_random_uuid(),
  owner_email           text,
  full_name             text not null,
  photo                 text,
  cover_image           text,
  title                 text,
  role                  text,                    -- expedition_roles.slug
  short_bio             text,
  bio                   text,
  age_range             text,
  gender                text,
  nationality           text,
  home_village          text,
  city                  text,
  district              text,
  country               text default 'Pakistan',
  phone                 text,
  whatsapp              text,
  email                 text,
  languages             text[] default '{}',
  years_experience      int,
  total_expeditions     int,
  total_treks           int,
  highest_altitude_m    int,
  highest_peak          text,
  peaks_summited        text[] default '{}',
  peaks_worked          text[] default '{}',
  routes_completed      text[] default '{}',
  successful_expeditions int,
  previous_companies    text[] default '{}',
  intl_experience       boolean not null default false,
  specializations       text[] default '{}',
  skills                text[] default '{}',
  availability_status   text default 'available', -- available | busy | seasonal
  daily_rate            numeric,
  package_rate          numeric,
  currency              text default 'PKR',
  min_days              int,
  max_days              int,
  negotiable            boolean not null default true,
  services_included     text[] default '{}',
  services_excluded     text[] default '{}',
  carrying_capacity_kg  int,
  max_altitude_m        int,
  equipment_owned       text[] default '{}',
  equipment_required    text[] default '{}',
  available_locations   text[] default '{}',
  available_peaks       text[] default '{}',
  available_routes      text[] default '{}',
  custom_quote          boolean not null default true,
  gallery               text[] default '{}',
  role_fields           jsonb not null default '{}'::jsonb, -- role-specific extras
  public_certs          text[] default '{}',    -- admin-approved public certificate labels
  -- private (never selected for public reads)
  private_docs          jsonb not null default '{}'::jsonb,
  verified              boolean not null default false,
  featured              boolean not null default false,
  status                text not null default 'pending',
  rating                numeric not null default 0,
  reviews               int not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists expedition_pros_status_idx on public.expedition_professionals (status);
create index if not exists expedition_pros_owner_idx  on public.expedition_professionals (owner_email);
create index if not exists expedition_pros_role_idx   on public.expedition_professionals (role);

/* ---------------- keep updated_at fresh ---------------- */
create or replace function public.touch_expedition_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
do $$
declare t text;
begin
  foreach t in array array['expedition_companies','expedition_professionals'] loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$s', t);
    execute format('create trigger trg_touch_%1$s before update on public.%1$s for each row execute function public.touch_expedition_updated_at()', t);
  end loop;
end $$;

/* ---------------- RLS (permissive/app-gated, matches project) ---------------- */
do $$
declare t text;
begin
  foreach t in array array[
    'expedition_roles','expedition_peaks','expedition_routes',
    'expedition_companies','expedition_professionals'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "read %1$s" on public.%1$s', t);
    execute format('create policy "read %1$s" on public.%1$s for select using (true)', t);
    execute format('drop policy if exists "insert %1$s" on public.%1$s', t);
    execute format('create policy "insert %1$s" on public.%1$s for insert with check (true)', t);
    execute format('drop policy if exists "update %1$s" on public.%1$s', t);
    execute format('create policy "update %1$s" on public.%1$s for update using (true) with check (true)', t);
    execute format('drop policy if exists "delete %1$s" on public.%1$s', t);
    execute format('create policy "delete %1$s" on public.%1$s for delete using (true)', t);
  end loop;
end $$;

/* ---------------- seed roles / peaks / routes (only if empty) ---------------- */
insert into public.expedition_roles (slug, name, display_order)
select v.slug, v.name, v.ord from (values
  ('expedition-leader','Expedition Leader',1),
  ('mountain-guide','Certified Mountain Guide',2),
  ('trekking-guide','Trekking Guide',3),
  ('high-altitude-porter','High-Altitude Porter',4),
  ('porter','Porter',5),
  ('expedition-cook','Expedition Cook',6),
  ('camp-manager','Camp Manager',7),
  ('camp-staff','Camp Staff',8),
  ('logistics-coordinator','Logistics Coordinator',9),
  ('rescue-coordinator','Rescue Coordinator',10),
  ('photographer','Photographer',11),
  ('videographer','Videographer',12),
  ('equipment-specialist','Equipment Specialist',13),
  ('oxygen-support','Oxygen Support Staff',14),
  ('medical-support','Medical Support Staff',15),
  ('other','Other Expedition Professional',16)
) as v(slug,name,ord)
where not exists (select 1 from public.expedition_roles);

insert into public.expedition_peaks (name, region, height_m, display_order)
select v.name, 'Gilgit-Baltistan', v.h, v.ord from (values
  ('K2',8611,1),('Broad Peak',8051,2),('Gasherbrum I',8080,3),('Gasherbrum II',8035,4),
  ('Nanga Parbat',8126,5),('Spantik',7027,6),('Masherbrum',7821,7)
) as v(name,h,ord)
where not exists (select 1 from public.expedition_peaks);

insert into public.expedition_routes (name, region, display_order)
select v.name, 'Gilgit-Baltistan', v.ord from (values
  ('Baltoro Glacier',1),('K2 Base Camp',2),('Gondogoro La',3),('Snow Lake',4),
  ('Biafo Glacier',5),('Hispar Glacier',6)
) as v(name,ord)
where not exists (select 1 from public.expedition_routes);
