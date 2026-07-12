-- ============================================================
-- SAFARIGB — Phase 6: booking chat messages
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid references public.bookings(id) on delete cascade,
  sender_email text not null,
  sender_name  text,
  text        text not null,
  created_at  timestamptz default now()
);

create index if not exists messages_booking_idx on public.messages (booking_id);

alter table public.messages enable row level security;

-- Prototype rules (open). Locked down with Auth later.
drop policy if exists "read messages" on public.messages;
create policy "read messages" on public.messages for select using (true);

drop policy if exists "insert messages" on public.messages;
create policy "insert messages" on public.messages for insert with check (true);
