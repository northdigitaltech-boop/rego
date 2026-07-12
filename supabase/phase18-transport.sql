-- ============================================================
-- SAFARIGB — Phase 18: Transport & Rental module
-- Independent transport providers offer Transport Services (with driver /
-- route) and Rental Vehicles (self-drive). Listings surface on the customer
-- Transport & Rental page alongside tour-company vehicles.
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

/* ---------------- Providers ---------------- */
create table if not exists public.transport_providers (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  owner_name          text,
  email               text,
  phone               text,
  whatsapp            text,
  business_type       text,   -- Individual | Company | Tour Company
  reg_number          text,
  license_number      text,
  logo                text,
  cover_image         text,
  address             text,
  service_areas       text[],
  description         text,
  opening_hours       text,
  emergency_contact   text,
  location            text,
  -- verification (hidden from customers)
  license_doc         text,
  owner_cnic          text,
  owner_cnic_doc      text,
  ownership_doc       text,
  rating              numeric not null default 0,
  reviews             int not null default 0,
  status              text not null default 'pending', -- pending|approved|rejected|suspended
  verified            boolean not null default false,
  featured            boolean not null default false,
  owner_email         text,
  created_at          timestamptz default now()
);
create index if not exists transport_providers_owner_idx on public.transport_providers (owner_email);
create index if not exists transport_providers_status_idx on public.transport_providers (status);

/* ---------------- Transport services (with driver / route) ---------------- */
create table if not exists public.transport_services (
  id                  uuid primary key default gen_random_uuid(),
  provider_id         uuid references public.transport_providers(id) on delete cascade,
  provider_name       text,
  listing_type        text not null default 'service',
  title               text not null,
  vehicle_type        text,   -- Jeep|Car|Van|Coaster|Bus|Bike
  vehicle_name        text,
  model_year          text,
  vehicle_number      text,
  seats               int,
  driver_included     boolean default true,
  driver_name         text,
  driver_contact      text,
  route               text,
  pickup_location     text,
  dropoff_location    text,
  price_per_trip      numeric,
  price_per_day       numeric not null default 0,
  price_per_km        numeric,
  waiting_charges     numeric,
  ac                  boolean default false,
  fuel_type           text,
  luggage             text,
  available_dates     text[],
  blocked_dates       text[],
  image               text,
  images              text[],
  description         text,
  rules               text,
  location            text,
  rating              numeric not null default 0,
  reviews             int not null default 0,
  status              text not null default 'pending',
  active              boolean not null default true,
  featured            boolean not null default false,
  owner_email         text,
  created_at          timestamptz default now()
);
create index if not exists transport_services_provider_idx on public.transport_services (provider_id);
create index if not exists transport_services_status_idx on public.transport_services (status);

/* ---------------- Rental vehicles (self-drive) ---------------- */
create table if not exists public.rental_vehicles (
  id                    uuid primary key default gen_random_uuid(),
  provider_id           uuid references public.transport_providers(id) on delete cascade,
  provider_name         text,
  listing_type          text not null default 'rental',
  title                 text not null,
  vehicle_type          text,   -- Car|Jeep|Bike|Van
  vehicle_name          text,
  model_year            text,
  vehicle_number        text,
  seats                 int,
  rental_type           text,   -- Self Drive | With Driver Optional | Private Rental
  price_per_hour        numeric,
  price_per_day         numeric not null default 0,
  weekly_price          numeric,
  monthly_price         numeric,
  security_deposit      numeric,
  required_documents    text[],
  pickup_location       text,
  return_location       text,
  mileage_limit         text,
  extra_mileage_charges numeric,
  fuel_policy           text,
  insurance_included    boolean default false,
  damage_policy         text,
  available_dates       text[],
  blocked_dates         text[],
  image                 text,
  images                text[],
  description           text,
  terms                 text,
  location              text,
  rating                numeric not null default 0,
  reviews               int not null default 0,
  status                text not null default 'pending',
  active                boolean not null default true,
  featured              boolean not null default false,
  owner_email           text,
  created_at            timestamptz default now()
);
create index if not exists rental_vehicles_provider_idx on public.rental_vehicles (provider_id);
create index if not exists rental_vehicles_status_idx on public.rental_vehicles (status);

/* ---------------- Bookings ---------------- */
create table if not exists public.transport_bookings (
  id              uuid primary key default gen_random_uuid(),
  provider_id     uuid references public.transport_providers(id) on delete set null,
  listing_type    text not null,   -- service | rental
  item_id         uuid,
  item_title      text not null,
  customer_email  text not null,
  customer_name   text,
  customer_phone  text,
  customer_city   text,
  notes           text,
  owner_email     text,
  pickup_location text,
  dropoff_location text,
  start_date      text,
  end_date        text,
  passengers      int not null default 1,
  total_price     numeric not null default 0,
  status          text not null default 'pending', -- pending|accepted|rejected
  created_at      timestamptz default now()
);
create index if not exists transport_bookings_provider_idx on public.transport_bookings (provider_id);
create index if not exists transport_bookings_owner_idx on public.transport_bookings (owner_email);
create index if not exists transport_bookings_customer_idx on public.transport_bookings (customer_email);
create index if not exists transport_bookings_item_idx on public.transport_bookings (item_id);

/* ---------------- Availability (blocked dates) ---------------- */
create table if not exists public.transport_availability (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid,
  item_type   text,   -- service | rental
  date        text,
  reason      text,   -- maintenance | private | unavailable
  owner_email text,
  created_at  timestamptz default now()
);
create index if not exists transport_availability_item_idx on public.transport_availability (item_id);

/* ---------------- RLS (permissive, matching project pattern) ---------------- */
do $$
declare t text;
begin
  foreach t in array array[
    'transport_providers','transport_services','rental_vehicles',
    'transport_bookings','transport_availability'
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
