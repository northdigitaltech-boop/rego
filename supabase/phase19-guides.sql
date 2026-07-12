-- ============================================================
-- SAFARIGB — Phase 19: Tour Guides module
-- Extends tour_guides to support INDEPENDENT guides (company_id null) in
-- addition to tour-company guides, and adds services, availability and an
-- independent booking flow. Reviews reuse the shared `reviews` table.
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

/* ---------------- Extend tour_guides ---------------- */
alter table public.tour_guides add column if not exists cnic                 text;
alter table public.tour_guides add column if not exists whatsapp             text;
alter table public.tour_guides add column if not exists email                text;
alter table public.tour_guides add column if not exists address              text;
alter table public.tour_guides add column if not exists city                 text;
alter table public.tour_guides add column if not exists guide_type           text;
alter table public.tour_guides add column if not exists price_per_trip       numeric;
alter table public.tour_guides add column if not exists hourly_price         numeric;
alter table public.tour_guides add column if not exists skills               text[];
alter table public.tour_guides add column if not exists gallery              text[];
alter table public.tour_guides add column if not exists social_links         text[];
alter table public.tour_guides add column if not exists emergency_contact    text;
alter table public.tour_guides add column if not exists min_hours            int;
alter table public.tour_guides add column if not exists max_days             int;
alter table public.tour_guides add column if not exists seasonal_availability text;
alter table public.tour_guides add column if not exists cnic_doc             text;
alter table public.tour_guides add column if not exists license_doc          text;
alter table public.tour_guides add column if not exists verified             boolean not null default false;
alter table public.tour_guides add column if not exists featured             boolean not null default false;

/* ---------------- Guide services ---------------- */
create table if not exists public.guide_services (
  id          uuid primary key default gen_random_uuid(),
  guide_id    uuid references public.tour_guides(id) on delete cascade,
  title       text not null,
  description text,
  price       numeric not null default 0,
  duration    text,   -- e.g. Full Day / Half Day / 4 hours
  area        text,
  owner_email text,
  created_at  timestamptz default now()
);
create index if not exists guide_services_guide_idx on public.guide_services (guide_id);

/* ---------------- Guide availability (blocked dates) ---------------- */
create table if not exists public.guide_availability (
  id          uuid primary key default gen_random_uuid(),
  guide_id    uuid references public.tour_guides(id) on delete cascade,
  date        text,
  reason      text,   -- blocked | private | seasonal | unavailable
  owner_email text,
  created_at  timestamptz default now()
);
create index if not exists guide_availability_guide_idx on public.guide_availability (guide_id);

/* ---------------- Guide bookings (independent guides) ---------------- */
create table if not exists public.guide_bookings (
  id              uuid primary key default gen_random_uuid(),
  guide_id        uuid references public.tour_guides(id) on delete set null,
  company_id      uuid,
  service_id      uuid,
  service_title   text,
  item_title      text not null,   -- guide name
  customer_email  text not null,
  customer_name   text,
  customer_phone  text,
  customer_city   text,
  notes           text,
  owner_email     text,
  pickup_location text,
  start_date      text,
  end_date        text,
  duration        text,
  guests          int not null default 1,
  total_price     numeric not null default 0,
  status          text not null default 'pending', -- pending | accepted | rejected
  created_at      timestamptz default now()
);
create index if not exists guide_bookings_guide_idx on public.guide_bookings (guide_id);
create index if not exists guide_bookings_owner_idx on public.guide_bookings (owner_email);
create index if not exists guide_bookings_customer_idx on public.guide_bookings (customer_email);

/* ---------------- RLS (permissive, matching project pattern) ---------------- */
do $$
declare t text;
begin
  foreach t in array array[
    'guide_services','guide_availability','guide_bookings'
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
