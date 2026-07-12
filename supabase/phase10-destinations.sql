-- ============================================================
-- SAFARIGB — Phase 10: admin-managed destinations
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

create table if not exists public.destinations (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  location    text not null,
  stays       text,
  tagline     text,
  image       text,
  created_at  timestamptz default now()
);

create index if not exists destinations_slug_idx on public.destinations (slug);

alter table public.destinations enable row level security;

-- Public can read destinations.
drop policy if exists "read destinations" on public.destinations;
create policy "read destinations" on public.destinations for select using (true);

-- Writes are gated to the admin screen at the application layer
-- (the app only exposes create/update/delete inside the admin dashboard).
drop policy if exists "insert destinations" on public.destinations;
create policy "insert destinations" on public.destinations for insert with check (true);

drop policy if exists "update destinations" on public.destinations;
create policy "update destinations" on public.destinations for update using (true) with check (true);

drop policy if exists "delete destinations" on public.destinations;
create policy "delete destinations" on public.destinations for delete using (true);

-- Seed the original destinations (safe to re-run).
insert into public.destinations (slug, name, location, stays, tagline, image) values
  ('skardu',        'Skardu',         'Skardu',        '120+ Stays', 'Gateway to the great Karakoram',            'https://loremflickr.com/1200/700/skardu,lake,mountains?lock=11'),
  ('hunza',         'Hunza Valley',   'Hunza',         '98+ Stays',  'Land of cherry blossoms and towering peaks', 'https://loremflickr.com/1200/700/hunza,valley,mountains?lock=12'),
  ('naran',         'Naran Valley',   'Naran',         '80+ Stays',  'Alpine lakes and green meadows',             'https://loremflickr.com/1200/700/valley,river,mountains?lock=13'),
  ('deosai',        'Deosai Plains',  'Deosai',        '45+ Stays',  'The roof of the world',                      'https://loremflickr.com/1200/700/meadow,plains,mountains?lock=14'),
  ('fairy-meadows', 'Fairy Meadows',  'Fairy Meadows', '35+ Stays',  'Base camp of mighty Nanga Parbat',           'https://loremflickr.com/1200/700/nanga,parbat,mountain?lock=15'),
  ('gilgit',        'Gilgit',         'Gilgit',        '60+ Stays',  'The vibrant heart of Gilgit Baltistan',      'https://loremflickr.com/1200/700/gilgit,town,mountains?lock=16'),
  ('shigar',        'Shigar',         'Shigar',        '40+ Stays',  'Historic forts and cold deserts',            'https://loremflickr.com/1200/700/fort,desert,mountains?lock=17'),
  ('khaplu',        'Khaplu',         'Khaplu',        '38+ Stays',  'Palaces beside the Shyok river',             'https://loremflickr.com/1200/700/palace,river,mountains?lock=18')
on conflict (slug) do nothing;
