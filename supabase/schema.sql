-- ============================================================
-- SAFARIGB — Hotels vertical schema (Phase 1)
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- 1. HOTELS TABLE -------------------------------------------------
create table if not exists public.hotels (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  category    text not null default 'hotels',   -- 'hotels' or 'homestays'
  category_label text not null default 'Hotel',
  location    text not null,
  price       integer not null,
  unit        text not null default 'night',
  rating      numeric(2,1) default 4.5,
  reviews     integer default 0,
  image       text,
  description text,
  amenities   text[] default '{}',
  featured    boolean default false,
  owner_email text,                             -- which provider owns it
  created_at  timestamptz default now()
);

-- 2. ROOMS TABLE --------------------------------------------------
create table if not exists public.rooms (
  id         uuid primary key default gen_random_uuid(),
  hotel_id   uuid references public.hotels(id) on delete cascade,
  name       text not null,
  price      integer not null,
  guests     integer default 2,
  beds       text default '1 Bed',
  features   text[] default '{}',
  created_at timestamptz default now()
);

-- 3. ROW LEVEL SECURITY ------------------------------------------
alter table public.hotels enable row level security;
alter table public.rooms  enable row level security;

-- Anyone can READ hotels and rooms (public marketplace).
drop policy if exists "public read hotels" on public.hotels;
create policy "public read hotels" on public.hotels for select using (true);

drop policy if exists "public read rooms" on public.rooms;
create policy "public read rooms" on public.rooms for select using (true);

-- (Insert/update policies for providers come in Phase 2.)

-- 4. SEED DATA (matches the current sample hotels) ---------------
insert into public.hotels (title, category, category_label, location, price, unit, rating, reviews, image, description, featured)
values
  ('Shangrila Resort Skardu','hotels','Hotel','Skardu',25000,'night',4.8,128,
   'https://loremflickr.com/900/600/resort,hotel,mountain?lock=21',
   'Luxury lakeside resort with breathtaking views of Shangrila Lake.', true),
  ('Serena Hunza Hotel','hotels','Hotel','Hunza',30000,'night',4.9,203,
   'https://loremflickr.com/900/600/luxury,hotel,resort?lock=26',
   'Premium hotel in the heart of Hunza with panoramic valley views.', false),
  ('Naran Valley Resort','hotels','Hotel','Naran',14000,'night',4.4,76,
   'https://loremflickr.com/900/600/resort,valley,mountain?lock=33',
   'Comfortable riverside resort in the green Naran valley.', false),
  ('Shigar Fort Residence','hotels','Heritage Hotel','Shigar',28000,'night',4.9,110,
   'https://loremflickr.com/900/600/fort,heritage,hotel?lock=41',
   'Restored 17th-century fort offering a unique heritage stay.', true),
  ('Khaplu Palace Hotel','hotels','Heritage Hotel','Khaplu',26000,'night',4.8,95,
   'https://loremflickr.com/900/600/palace,heritage,mountains?lock=42',
   'Historic palace hotel beside the Shyok river in Khaplu.', false)
on conflict do nothing;
