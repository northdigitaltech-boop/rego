-- ============================================================
-- REGO — Phase 40: Connect Solo Traveler
-- Solo travellers create a public travel profile and connect with other
-- travellers visiting the same GB destination — to find companions, share
-- transport/accommodation costs and travel more safely.
--
-- One profile per user (owner_email). Admins approve. Any signed-in user can
-- send a connection / join-trip request. Traveller↔traveller chat reuses the
-- shared `messages` table via a deterministic thread id (no FK needed), and
-- reviews reuse the shared `public.reviews` table (keyed by the traveller id),
-- so owner replies + new-review notifications work automatically.
-- Security-first RLS (owner / requester / admin), matching phase32/37.
-- Requires phase29 (is_admin).
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

/* ---------------- Traveller profiles ---------------- */
create table if not exists public.solo_travelers (
  id                       uuid primary key default gen_random_uuid(),
  owner_email              text,
  -- Header
  full_name                text not null,
  age                      int,
  gender                   text,
  nationality              text,
  current_city             text,
  profile_photo            text,
  cover_image              text,
  solo_badge               boolean not null default true,
  travel_score             int not null default 0,   -- 0..100 activity/quality
  last_active              timestamptz default now(),
  -- About me
  intro                    text,
  why_visiting             text,
  travel_experience        text,
  languages                text[],
  occupation               text,
  interests                text[],
  -- Current travel plan
  destinations             text[],
  departure_date           date,
  return_date              date,
  duration                 text,
  budget                   text,
  transportation_type      text,
  accommodation_preference text,
  available_seats          int,
  looking_for              text[],   -- Travel Partner / Photographer / Backpacker / Adventure Buddy / Family Companion
  gender_preference        text,
  age_preference           text,
  -- Preferences (badges)
  travel_preferences       text[],   -- Adventure / Hiking / Camping / Photography / ...
  -- Media
  gallery                  text[],
  videos                   text[],
  drone_shots              text[],
  -- Previous trips: [{ destination, date, rating, story, photos: [] }]
  previous_trips           jsonb,
  -- Safety & verification (display-only flags, admin/self-set)
  id_verified              boolean not null default false,
  phone_verified           boolean not null default false,
  email_verified           boolean not null default false,
  face_verified            boolean not null default false,
  emergency_verified       boolean not null default false,
  emergency_contact_status text,     -- e.g. 'Provided' / 'Verified'
  online                   boolean not null default false,
  -- Contact
  phone                    text,
  whatsapp                 text,
  email                    text,
  -- Meta
  rating                   numeric not null default 0,
  reviews                  int not null default 0,
  verified                 boolean not null default false,
  featured                 boolean not null default false,
  status                   text not null default 'pending', -- pending | approved | rejected | suspended
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);
create index if not exists solo_owner_idx  on public.solo_travelers (owner_email);
create index if not exists solo_status_idx on public.solo_travelers (status);
create index if not exists solo_city_idx   on public.solo_travelers (current_city);

/* ---------------- Connection / join-trip requests ---------------- */
create table if not exists public.solo_connections (
  id                  uuid primary key default gen_random_uuid(),
  traveler_id         uuid references public.solo_travelers(id) on delete set null,
  traveler_name       text,
  owner_email         text,               -- profile owner (recipient)
  requester_email     text not null,      -- sender
  requester_name      text,
  requester_avatar    text,
  kind                text not null default 'connect', -- connect | join-trip | invite
  seats               int not null default 1,           -- seats to reserve
  travel_date         date,                             -- preferred travel date
  pickup              text,                             -- pickup point / city
  message             text,
  status              text not null default 'pending',  -- pending | accepted | rejected
  created_at          timestamptz default now()
);
create index if not exists solo_conn_traveler_idx  on public.solo_connections (traveler_id);
create index if not exists solo_conn_owner_idx     on public.solo_connections (owner_email);
create index if not exists solo_conn_requester_idx on public.solo_connections (requester_email);

/* ---------------- RLS ---------------- */

-- Profiles: public reads approved; owner reads/manages own; admin everything.
do $$
declare pol record;
begin
  execute 'alter table public.solo_travelers enable row level security';
  for pol in select policyname from pg_policies where schemaname='public' and tablename='solo_travelers' loop
    execute format('drop policy if exists %I on public.solo_travelers', pol.policyname);
  end loop;
  create policy "solo_read" on public.solo_travelers for select
    using (status = 'approved' or owner_email = auth.email() or public.is_admin());
  create policy "solo_insert" on public.solo_travelers for insert
    with check (owner_email = auth.email() or public.is_admin());
  create policy "solo_update" on public.solo_travelers for update
    using (owner_email = auth.email() or public.is_admin())
    with check (owner_email = auth.email() or public.is_admin());
  create policy "solo_delete" on public.solo_travelers for delete
    using (owner_email = auth.email() or public.is_admin());
end $$;

-- Connections: requester + profile owner + admin can read; requester inserts;
-- both sides update (accept/reject); owner/admin delete.
do $$
declare pol record;
begin
  execute 'alter table public.solo_connections enable row level security';
  for pol in select policyname from pg_policies where schemaname='public' and tablename='solo_connections' loop
    execute format('drop policy if exists %I on public.solo_connections', pol.policyname);
  end loop;
  create policy "solo_conn_read" on public.solo_connections for select
    using (requester_email = auth.email() or owner_email = auth.email() or public.is_admin());
  create policy "solo_conn_insert" on public.solo_connections for insert
    with check (requester_email = auth.email() or public.is_admin());
  create policy "solo_conn_update" on public.solo_connections for update
    using (requester_email = auth.email() or owner_email = auth.email() or public.is_admin())
    with check (requester_email = auth.email() or owner_email = auth.email() or public.is_admin());
  create policy "solo_conn_delete" on public.solo_connections for delete
    using (owner_email = auth.email() or public.is_admin());
end $$;
