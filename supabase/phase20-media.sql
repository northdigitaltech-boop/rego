-- ============================================================
-- SAFARIGB — Phase 20: Photographer & Videographer (media) module
-- Independent providers (company_id null) and tour-company providers
-- (company_id set). Reviews reuse the shared `reviews` table.
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

/* ---------------- Providers ---------------- */
create table if not exists public.media_providers (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid,
  company_name      text,
  name              text not null,            -- full / business name
  logo              text,
  cover_image       text,
  cnic              text,
  phone             text,
  whatsapp          text,
  email             text,
  city              text,
  location          text,
  areas             text[],
  service_type      text,   -- Photographer | Videographer | Drone Pilot | Photographer + Videographer | Complete Media Team
  experience_years  int,
  languages         text[],
  bio               text,
  equipment         text,
  camera_models     text,
  drone_available   boolean not null default false,
  drone_license     text,   -- license/permit doc
  editing_included  boolean not null default true,
  delivery_time     text,
  starting_price    numeric not null default 0,
  social_links      text[],
  portfolio_link    text,
  seasonal_availability text,
  -- verification (hidden from customers)
  cnic_doc          text,
  license_doc       text,
  rating            numeric not null default 0,
  reviews           int not null default 0,
  status            text not null default 'pending',
  verified          boolean not null default false,
  featured          boolean not null default false,
  portfolio_views   int not null default 0,
  owner_email       text,
  created_at        timestamptz default now()
);
create index if not exists media_providers_owner_idx on public.media_providers (owner_email);
create index if not exists media_providers_status_idx on public.media_providers (status);
create index if not exists media_providers_company_idx on public.media_providers (company_id);

/* ---------------- Services ---------------- */
create table if not exists public.media_services (
  id              uuid primary key default gen_random_uuid(),
  provider_id     uuid references public.media_providers(id) on delete cascade,
  title           text not null,
  description     text,
  price           numeric not null default 0,
  duration        text,
  deliverables    text,
  edited_photos   int,
  videos          int,
  raw_files       boolean default false,
  drone_included  boolean default false,
  area            text,
  owner_email     text,
  created_at      timestamptz default now()
);
create index if not exists media_services_provider_idx on public.media_services (provider_id);

/* ---------------- Portfolio / gallery ---------------- */
create table if not exists public.media_portfolio (
  id           uuid primary key default gen_random_uuid(),
  provider_id  uuid references public.media_providers(id) on delete cascade,
  type         text,   -- photo | video | drone | reel | before_after
  url          text not null,
  caption      text,
  owner_email  text,
  created_at   timestamptz default now()
);
create index if not exists media_portfolio_provider_idx on public.media_portfolio (provider_id);

/* ---------------- Availability (blocked dates) ---------------- */
create table if not exists public.media_availability (
  id           uuid primary key default gen_random_uuid(),
  provider_id  uuid references public.media_providers(id) on delete cascade,
  date         text,
  reason       text,   -- blocked | private | seasonal | unavailable
  owner_email  text,
  created_at   timestamptz default now()
);
create index if not exists media_availability_provider_idx on public.media_availability (provider_id);

/* ---------------- Bookings ---------------- */
create table if not exists public.media_bookings (
  id               uuid primary key default gen_random_uuid(),
  provider_id      uuid references public.media_providers(id) on delete set null,
  company_id       uuid,
  service_id       uuid,
  service_title    text,
  item_title       text not null,   -- provider name
  customer_email   text not null,
  customer_name    text,
  customer_phone   text,
  customer_city    text,
  notes            text,
  owner_email      text,
  location         text,
  start_date       text,
  end_date         text,
  duration         text,
  people           int not null default 1,
  shoot_type       text,
  drone_required   boolean default false,
  editing_required boolean default true,
  total_price      numeric not null default 0,
  delivery_link    text,
  status           text not null default 'pending', -- pending | accepted | rejected | completed
  created_at       timestamptz default now()
);
create index if not exists media_bookings_provider_idx on public.media_bookings (provider_id);
create index if not exists media_bookings_owner_idx on public.media_bookings (owner_email);
create index if not exists media_bookings_customer_idx on public.media_bookings (customer_email);

/* ---------------- RLS (permissive, matching project pattern) ---------------- */
do $$
declare t text;
begin
  foreach t in array array[
    'media_providers','media_services','media_portfolio',
    'media_availability','media_bookings'
  ] loop
    execute format('alter table public.%s enable row level security', t);
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
