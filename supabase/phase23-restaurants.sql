-- ============================================================
-- SAFARIGB — Phase 23: Restaurant module
-- Independent restaurants (property_id null) and hotel/resort/homestay
-- restaurants (property_id set). Reviews reuse the shared `reviews` table;
-- gallery is stored as an array on the restaurant row.
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

/* ---------------- Restaurants ---------------- */
create table if not exists public.restaurants (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid,
  property_type   text,   -- hotel | homestay
  property_name   text,
  name            text not null,
  owner_name      text,
  logo            text,
  cover_image     text,
  gallery         text[],
  phone           text,
  whatsapp        text,
  email           text,
  address         text,
  map_link        text,
  city            text,
  location        text,
  opening_hours   text,
  closing_hours   text,
  cuisine_types   text[],
  dining_options  text[],
  price_range     text,   -- Budget | Mid-range | Fine dining
  description     text,
  facilities      text[],
  social_links    text[],
  license_doc     text,   -- food safety / license (hidden from customers)
  owner_cnic      text,
  owner_cnic_doc  text,
  rating          numeric not null default 0,
  reviews         int not null default 0,
  status          text not null default 'pending',
  verified        boolean not null default false,
  featured        boolean not null default false,
  menu_views      int not null default 0,
  pending_changes jsonb,
  pending_at      timestamptz,
  owner_email     text,
  created_at      timestamptz default now()
);
create index if not exists restaurants_owner_idx on public.restaurants (owner_email);
create index if not exists restaurants_status_idx on public.restaurants (status);
create index if not exists restaurants_property_idx on public.restaurants (property_id);

/* ---------------- Menu items ---------------- */
create table if not exists public.restaurant_menu_items (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  name          text not null,
  category      text,   -- Breakfast | Lunch | Dinner | BBQ | Fast Food | Traditional Food | Drinks | Desserts | Tea / Coffee | Special Deals
  image         text,
  description   text,
  price         numeric not null default 0,
  discount_price numeric,
  prep_time     text,
  serving_size  text,
  availability  text not null default 'available', -- available | unavailable
  featured      boolean not null default false,
  spicy_level   text,   -- Mild | Medium | Spicy
  vegetarian    boolean not null default false,
  owner_email   text,
  created_at    timestamptz default now()
);
create index if not exists restaurant_menu_restaurant_idx on public.restaurant_menu_items (restaurant_id);

/* ---------------- Bookings / inquiries ---------------- */
create table if not exists public.restaurant_bookings (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid references public.restaurants(id) on delete set null,
  property_id     uuid,
  booking_type    text not null default 'table', -- table | inquiry
  item_title      text not null,                 -- restaurant name
  customer_email  text not null,
  customer_name   text,
  customer_phone  text,
  notes           text,
  owner_email     text,
  date            text,
  time            text,
  guests          int not null default 1,
  status          text not null default 'pending', -- pending | accepted | rejected
  created_at      timestamptz default now()
);
create index if not exists restaurant_bookings_restaurant_idx on public.restaurant_bookings (restaurant_id);
create index if not exists restaurant_bookings_owner_idx on public.restaurant_bookings (owner_email);
create index if not exists restaurant_bookings_customer_idx on public.restaurant_bookings (customer_email);

/* ---------------- RLS (permissive, matching project pattern) ---------------- */
do $$
declare t text;
begin
  foreach t in array array[
    'restaurants','restaurant_menu_items','restaurant_bookings'
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
