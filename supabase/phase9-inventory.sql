-- ============================================================
-- SAFARIGB — Phase A: room inventory + availability
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

-- Hotel: total rooms in the property
alter table public.hotels  add column if not exists total_rooms int default 0;

-- Room type fields
alter table public.rooms   add column if not exists room_type   text default 'Standard';
alter table public.rooms   add column if not exists total_units int  default 1;
alter table public.rooms   add column if not exists images      text[] default '{}';

-- Per-room lines of each booking (for availability + analytics)
create table if not exists public.booking_rooms (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid references public.bookings(id) on delete cascade,
  room_id     uuid references public.rooms(id) on delete set null,
  hotel_id    uuid,
  room_name   text,
  units       int default 1,
  check_in    date,
  check_out   date,
  status      text default 'pending',   -- pending | accepted | rejected
  created_at  timestamptz default now()
);

create index if not exists booking_rooms_room_idx on public.booking_rooms (room_id);
create index if not exists booking_rooms_hotel_idx on public.booking_rooms (hotel_id);

alter table public.booking_rooms enable row level security;

drop policy if exists "read br" on public.booking_rooms;
create policy "read br" on public.booking_rooms for select using (true);

drop policy if exists "insert br" on public.booking_rooms;
create policy "insert br" on public.booking_rooms for insert with check (true);

drop policy if exists "update br" on public.booking_rooms;
create policy "update br" on public.booking_rooms for update using (true) with check (true);
