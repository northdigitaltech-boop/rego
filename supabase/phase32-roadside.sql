-- ============================================================
-- SAFARIGB — Phase 32: Roadside Assistance module
-- Providers + their per-service prices + emergency requests + reviews.
-- Security-first RLS (owner / customer / admin), matching phase30 style.
-- Ownership is keyed on auth.email(); admins via public.is_admin() (phase29).
--
-- PREREQUISITES: phase29 (profiles + is_admin) run.
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

/* ---------------- Providers ---------------- */
create table if not exists public.roadside_providers (
  id                 uuid primary key default gen_random_uuid(),
  owner_email        text,                 -- account email (RLS ownership)
  business_name      text not null,
  owner_name         text,
  phone              text,
  whatsapp           text,
  email              text,
  address            text,
  city               text,
  service_areas      text[],
  description        text,
  profile_image      text,                 -- logo
  cover_image        text,
  gallery_images     text[],
  is_24_7            boolean not null default false,
  availability_status text not null default 'available', -- available | offline
  response_time      text,                 -- e.g. "15-30 min"
  verification_doc   text,                 -- optional (hidden from customers)
  rating             numeric not null default 0,
  total_reviews      int not null default 0,
  verified           boolean not null default false,
  featured           boolean not null default false,
  ranking_badge      text,
  status             text not null default 'pending', -- pending | approved | rejected | suspended
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);
create index if not exists roadside_providers_owner_idx on public.roadside_providers (owner_email);
create index if not exists roadside_providers_status_idx on public.roadside_providers (status);
create index if not exists roadside_providers_city_idx on public.roadside_providers (city);

/* ---------------- Provider services (per-service prices) ---------------- */
create table if not exists public.roadside_provider_services (
  id             uuid primary key default gen_random_uuid(),
  provider_id    uuid references public.roadside_providers(id) on delete cascade,
  service_type   text not null,   -- bike-puncture | car-puncture | battery-service | fuel-delivery | vehicle-recovery
  starting_price numeric not null default 0,
  description    text,
  owner_email    text,            -- mirror of provider owner (RLS writes)
  created_at     timestamptz default now()
);
create index if not exists roadside_services_provider_idx on public.roadside_provider_services (provider_id);
create index if not exists roadside_services_type_idx on public.roadside_provider_services (service_type);

/* ---------------- Requests (emergency help) ---------------- */
create table if not exists public.roadside_requests (
  id                     uuid primary key default gen_random_uuid(),
  request_number         text unique,
  customer_email         text not null,   -- RLS: the requesting customer
  provider_id            uuid references public.roadside_providers(id) on delete set null,
  owner_email            text,            -- provider's owner email (RLS: provider sees request)
  service_type           text,
  provider_name          text,
  customer_name          text,
  customer_phone         text,
  customer_whatsapp      text,
  location_address       text,
  vehicle_type           text,            -- Bike | Car | Van | Jeep | Other
  problem_description    text,
  image_url              text,
  urgency                text not null default 'normal', -- normal | urgent | emergency
  preferred_contact_method text,          -- call | whatsapp
  status                 text not null default 'pending', -- pending | accepted | on_the_way | completed | cancelled
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
);
create index if not exists roadside_requests_customer_idx on public.roadside_requests (customer_email);
create index if not exists roadside_requests_owner_idx on public.roadside_requests (owner_email);
create index if not exists roadside_requests_provider_idx on public.roadside_requests (provider_id);
create index if not exists roadside_requests_status_idx on public.roadside_requests (status);

/* ---------------- Reviews ---------------- */
create table if not exists public.roadside_reviews (
  id             uuid primary key default gen_random_uuid(),
  provider_id    uuid references public.roadside_providers(id) on delete cascade,
  request_id     uuid references public.roadside_requests(id) on delete set null,
  customer_email text,
  customer_name  text,
  rating         int not null default 5,
  review_text    text,
  created_at     timestamptz default now()
);
create index if not exists roadside_reviews_provider_idx on public.roadside_reviews (provider_id);

/* ============================================================
 * RLS
 * ============================================================ */

-- Providers: public reads only approved rows; owner reads/manages own
-- (incl. pending/rejected/suspended); admin does everything.
do $$
declare pol record;
begin
  execute 'alter table public.roadside_providers enable row level security';
  for pol in select policyname from pg_policies where schemaname='public' and tablename='roadside_providers' loop
    execute format('drop policy if exists %I on public.roadside_providers', pol.policyname);
  end loop;
  create policy "rp_read" on public.roadside_providers for select
    using (status = 'approved' or owner_email = auth.email() or public.is_admin());
  create policy "rp_insert" on public.roadside_providers for insert
    with check (owner_email = auth.email() or public.is_admin());
  create policy "rp_update" on public.roadside_providers for update
    using (owner_email = auth.email() or public.is_admin())
    with check (owner_email = auth.email() or public.is_admin());
  create policy "rp_delete" on public.roadside_providers for delete
    using (owner_email = auth.email() or public.is_admin());
end $$;

-- Provider services: readable by anyone (public catalog); writes by owner/admin.
do $$
declare pol record;
begin
  execute 'alter table public.roadside_provider_services enable row level security';
  for pol in select policyname from pg_policies where schemaname='public' and tablename='roadside_provider_services' loop
    execute format('drop policy if exists %I on public.roadside_provider_services', pol.policyname);
  end loop;
  create policy "rps_read" on public.roadside_provider_services for select using (true);
  create policy "rps_insert" on public.roadside_provider_services for insert
    with check (owner_email = auth.email() or public.is_admin());
  create policy "rps_update" on public.roadside_provider_services for update
    using (owner_email = auth.email() or public.is_admin())
    with check (owner_email = auth.email() or public.is_admin());
  create policy "rps_delete" on public.roadside_provider_services for delete
    using (owner_email = auth.email() or public.is_admin());
end $$;

-- Requests: customer sees/creates/updates own; provider (owner) sees/updates
-- requests routed to them; admin does everything.
do $$
declare pol record;
begin
  execute 'alter table public.roadside_requests enable row level security';
  for pol in select policyname from pg_policies where schemaname='public' and tablename='roadside_requests' loop
    execute format('drop policy if exists %I on public.roadside_requests', pol.policyname);
  end loop;
  create policy "rr_read" on public.roadside_requests for select
    using (customer_email = auth.email() or owner_email = auth.email() or public.is_admin());
  create policy "rr_insert" on public.roadside_requests for insert
    with check (customer_email = auth.email() or public.is_admin());
  create policy "rr_update" on public.roadside_requests for update
    using (customer_email = auth.email() or owner_email = auth.email() or public.is_admin())
    with check (customer_email = auth.email() or owner_email = auth.email() or public.is_admin());
  create policy "rr_delete" on public.roadside_requests for delete
    using (owner_email = auth.email() or public.is_admin());
end $$;

-- Reviews: public reads; customer inserts own; admin manages.
do $$
declare pol record;
begin
  execute 'alter table public.roadside_reviews enable row level security';
  for pol in select policyname from pg_policies where schemaname='public' and tablename='roadside_reviews' loop
    execute format('drop policy if exists %I on public.roadside_reviews', pol.policyname);
  end loop;
  create policy "rrev_read" on public.roadside_reviews for select using (true);
  create policy "rrev_insert" on public.roadside_reviews for insert
    with check (customer_email = auth.email() or public.is_admin());
  create policy "rrev_update" on public.roadside_reviews for update
    using (public.is_admin()) with check (public.is_admin());
  create policy "rrev_delete" on public.roadside_reviews for delete
    using (customer_email = auth.email() or public.is_admin());
end $$;
