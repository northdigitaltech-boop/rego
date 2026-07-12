-- ============================================================
-- SAFARIGB — Phase 7: customer reviews
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

create table if not exists public.reviews (
  id              uuid primary key default gen_random_uuid(),
  hotel_id        uuid references public.hotels(id) on delete cascade,
  customer_email  text not null,
  customer_name   text,
  customer_avatar text,
  rating          int not null check (rating between 1 and 5),
  text            text,
  created_at      timestamptz default now()
);

create index if not exists reviews_hotel_idx on public.reviews (hotel_id);

alter table public.reviews enable row level security;

drop policy if exists "read reviews" on public.reviews;
create policy "read reviews" on public.reviews for select using (true);

drop policy if exists "insert reviews" on public.reviews;
create policy "insert reviews" on public.reviews for insert with check (true);
