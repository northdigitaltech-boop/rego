-- ============================================================
-- SAFARIGB — Phase 14: Homestay module (separate tables)
-- Mirrors the Hotel module with homestay-specific fields and an
-- expanded, embedded room configuration.
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

/* ---------------- Homestays ---------------- */
create table if not exists public.homestays (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  category            text not null default 'homestays',
  category_label      text not null default 'Homestay',
  location            text not null,
  address             text,
  map_link            text,
  price               numeric not null default 0,   -- starting price / night
  unit                text not null default 'night',
  rating              numeric not null default 0,
  reviews             int not null default 0,
  image               text,
  description         text,
  amenities           text[],
  gallery             text[],
  checkin_time        text,
  checkout_time       text,
  house_rules         text,
  cancellation_policy text,
  blocked_dates       text[],   -- ISO dates blocked by the owner
  maintenance_dates   text[],   -- ISO dates under maintenance
  min_stay            int,
  max_stay            int,
  total_rooms         int not null default 0,
  featured            boolean not null default false,
  status              text not null default 'pending', -- pending | approved | rejected
  -- Verification (hidden from customers at the app layer)
  reg_number          text,
  license_doc         text,
  owner_cnic          text,
  owner_cnic_doc      text,
  ownership_doc       text,
  verified            boolean not null default false,
  owner_email         text,
  created_at          timestamptz default now()
);

create index if not exists homestays_status_idx on public.homestays (status);
create index if not exists homestays_owner_idx on public.homestays (owner_email);

/* ---------------- Homestay rooms (embedded in the listing form) ---------------- */
create table if not exists public.homestay_rooms (
  id                  uuid primary key default gen_random_uuid(),
  homestay_id         uuid references public.homestays(id) on delete cascade,
  name                text not null,
  room_type           text,   -- Entire Home | Private Room | Shared Room
  total_units         int not null default 1,
  max_guests          int not null default 2,
  beds                text,
  bedrooms            int,
  bathrooms           int,
  room_size           text,
  price               numeric not null default 0,   -- per night
  weekend_price       numeric,
  seasonal_price      numeric,
  extra_guest_charges numeric,
  images              text[],
  description         text,
  amenities           text[],
  created_at          timestamptz default now()
);

create index if not exists homestay_rooms_homestay_idx on public.homestay_rooms (homestay_id);

/* ---------------- Homestay bookings ---------------- */
create table if not exists public.homestay_bookings (
  id              uuid primary key default gen_random_uuid(),
  homestay_id     uuid references public.homestays(id) on delete set null,
  homestay_title  text not null,
  room_name       text,
  customer_email  text not null,
  customer_name   text,
  customer_phone  text,
  customer_city   text,
  notes           text,
  owner_email     text,
  check_in        text,
  check_out       text,
  guests          int not null default 1,
  rooms           int not null default 1,
  total_price     numeric not null default 0,
  status          text not null default 'pending', -- pending | accepted | rejected
  created_at      timestamptz default now()
);

create index if not exists homestay_bookings_customer_idx on public.homestay_bookings (customer_email);
create index if not exists homestay_bookings_owner_idx on public.homestay_bookings (owner_email);

/* ---------------- Homestay booking rooms (inventory tracking) ---------------- */
create table if not exists public.homestay_booking_rooms (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid references public.homestay_bookings(id) on delete cascade,
  room_id      uuid,
  homestay_id  uuid,
  room_name    text,
  units        int not null default 1,
  check_in     text,
  check_out    text,
  status       text not null default 'pending', -- pending | accepted | rejected
  created_at   timestamptz default now()
);

create index if not exists homestay_booking_rooms_room_idx on public.homestay_booking_rooms (room_id);
create index if not exists homestay_booking_rooms_hs_idx on public.homestay_booking_rooms (homestay_id);

/* ---------------- Row level security (permissive, matching project pattern) ---------------- */
alter table public.homestays enable row level security;
alter table public.homestay_rooms enable row level security;
alter table public.homestay_bookings enable row level security;
alter table public.homestay_booking_rooms enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'homestays','homestay_rooms','homestay_bookings','homestay_booking_rooms'
  ] loop
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
