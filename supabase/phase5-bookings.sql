-- ============================================================
-- SAFARIGB — Phase 5: bookings
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

create table if not exists public.bookings (
  id            uuid primary key default gen_random_uuid(),
  hotel_id      uuid references public.hotels(id) on delete set null,
  hotel_title   text not null,
  room_name     text,
  customer_email text not null,
  customer_name  text,
  owner_email   text,
  check_in      date,
  check_out     date,
  guests        integer default 1,
  total_price   integer default 0,
  status        text not null default 'pending',  -- pending | accepted | rejected
  created_at    timestamptz default now()
);

alter table public.bookings enable row level security;

-- Prototype rules (open). Locked down with Auth later.
drop policy if exists "read bookings" on public.bookings;
create policy "read bookings" on public.bookings for select using (true);

drop policy if exists "insert bookings" on public.bookings;
create policy "insert bookings" on public.bookings for insert with check (true);

drop policy if exists "update bookings" on public.bookings;
create policy "update bookings" on public.bookings for update using (true) with check (true);
