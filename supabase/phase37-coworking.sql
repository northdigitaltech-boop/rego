-- ============================================================
-- SAFARIGB — Phase 37: Co-working Spaces
-- For remote workers / freelancers spending time in GB who need office space.
-- Providers register a space (owner-owned); admins approve; customers browse
-- and send booking inquiries. Reviews reuse the shared public.reviews table
-- (keyed by the space id), so owner replies work automatically.
-- Security-first RLS (owner / customer / admin), matching phase30/phase32.
-- Requires phase29 (is_admin).
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

/* ---------------- Spaces ---------------- */
create table if not exists public.coworking_spaces (
  id                   uuid primary key default gen_random_uuid(),
  owner_email          text,
  name                 text not null,
  owner_name           text,
  logo                 text,
  cover_image          text,
  gallery              text[],
  description          text,
  city                 text,
  location             text,
  address              text,
  phone                text,
  whatsapp             text,
  email                text,
  amenities            text[],
  wifi_speed           text,
  opening_hours        text,
  seating_capacity     int,
  hot_desk_price       numeric,   -- per day
  dedicated_desk_price numeric,   -- per month
  private_office_price numeric,   -- per month
  meeting_room_price   numeric,   -- per hour
  day_pass_available   boolean not null default true,
  monthly_available    boolean not null default true,
  map_link             text,
  social_links         text[],
  rating               numeric not null default 0,
  reviews              int not null default 0,
  verified             boolean not null default false,
  featured             boolean not null default false,
  ranking_badge        text,
  status               text not null default 'pending', -- pending | approved | rejected | suspended
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);
create index if not exists coworking_owner_idx on public.coworking_spaces (owner_email);
create index if not exists coworking_status_idx on public.coworking_spaces (status);
create index if not exists coworking_city_idx on public.coworking_spaces (city);

/* ---------------- Booking inquiries ---------------- */
create table if not exists public.coworking_bookings (
  id             uuid primary key default gen_random_uuid(),
  space_id       uuid references public.coworking_spaces(id) on delete set null,
  space_name     text,
  owner_email    text,
  customer_email text not null,
  customer_name  text,
  customer_phone text,
  plan_type      text,    -- hot-desk | dedicated-desk | private-office | meeting-room | day-pass
  start_date     date,
  duration       text,
  people         int not null default 1,
  notes          text,
  status         text not null default 'pending', -- pending | accepted | rejected | completed
  created_at     timestamptz default now()
);
create index if not exists coworking_bk_space_idx on public.coworking_bookings (space_id);
create index if not exists coworking_bk_owner_idx on public.coworking_bookings (owner_email);
create index if not exists coworking_bk_customer_idx on public.coworking_bookings (customer_email);

/* ---------------- RLS ---------------- */

-- Spaces: public reads approved; owner reads/manages own; admin everything.
do $$
declare pol record;
begin
  execute 'alter table public.coworking_spaces enable row level security';
  for pol in select policyname from pg_policies where schemaname='public' and tablename='coworking_spaces' loop
    execute format('drop policy if exists %I on public.coworking_spaces', pol.policyname);
  end loop;
  create policy "cw_read" on public.coworking_spaces for select
    using (status = 'approved' or owner_email = auth.email() or public.is_admin());
  create policy "cw_insert" on public.coworking_spaces for insert
    with check (owner_email = auth.email() or public.is_admin());
  create policy "cw_update" on public.coworking_spaces for update
    using (owner_email = auth.email() or public.is_admin())
    with check (owner_email = auth.email() or public.is_admin());
  create policy "cw_delete" on public.coworking_spaces for delete
    using (owner_email = auth.email() or public.is_admin());
end $$;

-- Bookings: customer sees/creates/updates own; owner sees/updates theirs; admin everything.
do $$
declare pol record;
begin
  execute 'alter table public.coworking_bookings enable row level security';
  for pol in select policyname from pg_policies where schemaname='public' and tablename='coworking_bookings' loop
    execute format('drop policy if exists %I on public.coworking_bookings', pol.policyname);
  end loop;
  create policy "cwb_read" on public.coworking_bookings for select
    using (customer_email = auth.email() or owner_email = auth.email() or public.is_admin());
  create policy "cwb_insert" on public.coworking_bookings for insert
    with check (customer_email = auth.email() or public.is_admin());
  create policy "cwb_update" on public.coworking_bookings for update
    using (customer_email = auth.email() or owner_email = auth.email() or public.is_admin())
    with check (customer_email = auth.email() or owner_email = auth.email() or public.is_admin());
  create policy "cwb_delete" on public.coworking_bookings for delete
    using (owner_email = auth.email() or public.is_admin());
end $$;
