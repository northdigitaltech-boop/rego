-- ============================================================
-- SAFARIGB — Phase 16: Tour Company module
-- Tour companies own packages, transports (vehicles) and guides.
-- Items are linked via company_id and surface on customer category pages.
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

/* ---------------- Tour companies ---------------- */
create table if not exists public.tour_companies (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  owner_name          text,
  email               text,
  phone               text,
  whatsapp            text,
  reg_number          text,
  license_number      text,
  logo                text,
  cover_image         text,
  gallery             text[],
  office_address      text,
  service_areas       text[],
  destinations        text[],
  description         text,
  experience_years    int,
  languages           text[],
  emergency_contact   text,
  opening_hours       text,
  social_links        text[],
  website             text,
  -- verification (hidden from customers at the app layer)
  license_doc         text,
  owner_cnic          text,
  owner_cnic_doc      text,
  ownership_doc       text,
  terms               text,
  cancellation_policy text,
  rating              numeric not null default 0,
  reviews             int not null default 0,
  location            text,
  status              text not null default 'pending', -- pending|approved|rejected|suspended
  verified            boolean not null default false,
  featured            boolean not null default false,
  owner_email         text,
  created_at          timestamptz default now()
);

create index if not exists tour_companies_owner_idx on public.tour_companies (owner_email);
create index if not exists tour_companies_status_idx on public.tour_companies (status);

/* ---------------- Tour packages ---------------- */
create table if not exists public.tour_packages (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid references public.tour_companies(id) on delete cascade,
  company_name          text,
  title                 text not null,
  destination           text,
  location              text,
  duration              text,
  package_type          text,   -- Family|Couple|Group|Adventure|Cultural|Honeymoon|Custom
  price_per_person      numeric not null default 0,
  group_price           numeric,
  min_persons           int,
  max_persons           int,
  start_location        text,
  end_location          text,
  included              text[],
  excluded              text[],
  itinerary             text,
  accommodation_included boolean default false,
  transport_included    boolean default false,
  guide_included        boolean default false,
  meals_included        boolean default false,
  image                 text,
  images                text[],
  available_dates       text[],
  difficulty_level      text,
  cancellation_policy   text,
  terms                 text,
  rating                numeric not null default 0,
  reviews               int not null default 0,
  status                text not null default 'pending',
  active                boolean not null default true,
  owner_email           text,
  created_at            timestamptz default now()
);

create index if not exists tour_packages_company_idx on public.tour_packages (company_id);
create index if not exists tour_packages_status_idx on public.tour_packages (status);

/* ---------------- Transports (vehicles) ---------------- */
create table if not exists public.transports (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid references public.tour_companies(id) on delete cascade,
  company_name        text,
  name                text not null,
  vehicle_type        text,   -- Jeep|Car|Van|Coaster|Bus|Bike
  model_year          text,
  vehicle_number      text,
  seats               int,
  driver_included     boolean default true,
  driver_name         text,
  driver_contact      text,
  price_per_day       numeric not null default 0,
  price_per_trip      numeric,
  areas               text[],
  location            text,
  image               text,
  images              text[],
  ac                  boolean default false,
  fuel_type           text,
  availability_status text default 'available',
  rating              numeric not null default 0,
  reviews             int not null default 0,
  status              text not null default 'pending',
  active              boolean not null default true,
  owner_email         text,
  created_at          timestamptz default now()
);

create index if not exists transports_company_idx on public.transports (company_id);
create index if not exists transports_status_idx on public.transports (status);

/* ---------------- Tour guides ---------------- */
create table if not exists public.tour_guides (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid references public.tour_companies(id) on delete cascade,
  company_name        text,
  name                text not null,
  image               text,
  phone               text,
  languages           text[],
  experience_years    int,
  specialization      text,   -- Trekking|Cultural|City|Mountain|Adventure
  areas               text[],
  location            text,
  price_per_day       numeric not null default 0,
  availability_status text default 'available',
  bio                 text,
  certifications      text[],
  rating              numeric not null default 0,
  reviews             int not null default 0,
  status              text not null default 'pending',
  active              boolean not null default true,
  owner_email         text,
  created_at          timestamptz default now()
);

create index if not exists tour_guides_company_idx on public.tour_guides (company_id);
create index if not exists tour_guides_status_idx on public.tour_guides (status);

/* ---------------- Tour bookings (packages / transport / guides) ---------------- */
create table if not exists public.tour_bookings (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid references public.tour_companies(id) on delete set null,
  item_type       text not null,   -- package|transport|guide
  item_id         uuid,
  item_title      text not null,
  customer_email  text not null,
  customer_name   text,
  customer_phone  text,
  customer_city   text,
  notes           text,
  owner_email     text,
  start_date      text,
  end_date        text,
  guests          int not null default 1,
  total_price     numeric not null default 0,
  status          text not null default 'pending', -- pending|accepted|rejected
  created_at      timestamptz default now()
);

create index if not exists tour_bookings_company_idx on public.tour_bookings (company_id);
create index if not exists tour_bookings_owner_idx on public.tour_bookings (owner_email);
create index if not exists tour_bookings_customer_idx on public.tour_bookings (customer_email);

/* ---------------- RLS (permissive, matching project pattern) ---------------- */
do $$
declare t text;
begin
  foreach t in array array[
    'tour_companies','tour_packages','transports','tour_guides','tour_bookings'
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
