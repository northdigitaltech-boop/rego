-- ============================================================
-- SAFARIGB — Phase 39: Activities & Adventures
-- Activities (camping, trekking, hiking, jeep safari, horse riding, fishing,
-- boating, cultural tours) can be listed by THREE kinds of owners:
--   * an individual activity / adventure / safari company (owner_type = 'activity-provider')
--   * a travel company (owner_type = 'travel-company')
--   * a tour guide (owner_type = 'guide')
-- Every activity is keyed on owner_email for RLS. Customers browse approved
-- activities and send booking inquiries. Reviews reuse the shared reviews table.
-- Requires phase29 (is_admin).
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

/* ---------------- Activities ---------------- */
create table if not exists public.activities (
  id              uuid primary key default gen_random_uuid(),
  owner_email     text,
  owner_type      text not null default 'activity-provider', -- activity-provider | travel-company | guide
  business_name   text,
  title           text not null,
  category        text not null,   -- camping | trekking | hiking | jeep-safari | horse-riding | fishing | boating | cultural-tours
  description     text,
  location        text,
  city            text,
  meeting_point   text,
  duration        text,            -- e.g. "Full day", "3 days 2 nights"
  difficulty      text,            -- easy | moderate | hard
  group_size_min  int,
  group_size_max  int,
  price           numeric not null default 0,
  price_unit      text not null default 'person', -- person | group | day
  age_limit       text,
  season          text,
  includes        text[],
  excludes        text[],
  languages       text[],
  highlights      text[],
  image           text,            -- cover
  gallery         text[],
  phone           text,
  whatsapp        text,
  email           text,
  map_link        text,
  rating          numeric not null default 0,
  reviews         int not null default 0,
  verified        boolean not null default false,
  featured        boolean not null default false,
  ranking_badge   text,
  status          text not null default 'pending', -- pending | approved | rejected | suspended
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists activities_owner_idx on public.activities (owner_email);
create index if not exists activities_category_idx on public.activities (category);
create index if not exists activities_status_idx on public.activities (status);

/* ---------------- Booking inquiries ---------------- */
create table if not exists public.activity_bookings (
  id             uuid primary key default gen_random_uuid(),
  activity_id    uuid references public.activities(id) on delete set null,
  activity_title text,
  owner_email    text,
  customer_email text not null,
  customer_name  text,
  customer_phone text,
  date           date,
  people         int not null default 1,
  notes          text,
  status         text not null default 'pending', -- pending | accepted | rejected | completed
  created_at     timestamptz default now()
);
create index if not exists activity_bk_activity_idx on public.activity_bookings (activity_id);
create index if not exists activity_bk_owner_idx on public.activity_bookings (owner_email);
create index if not exists activity_bk_customer_idx on public.activity_bookings (customer_email);

/* ---------------- RLS ---------------- */

do $$
declare pol record;
begin
  execute 'alter table public.activities enable row level security';
  for pol in select policyname from pg_policies where schemaname='public' and tablename='activities' loop
    execute format('drop policy if exists %I on public.activities', pol.policyname);
  end loop;
  create policy "act_read" on public.activities for select
    using (status = 'approved' or owner_email = auth.email() or public.is_admin());
  create policy "act_insert" on public.activities for insert
    with check (owner_email = auth.email() or public.is_admin());
  create policy "act_update" on public.activities for update
    using (owner_email = auth.email() or public.is_admin())
    with check (owner_email = auth.email() or public.is_admin());
  create policy "act_delete" on public.activities for delete
    using (owner_email = auth.email() or public.is_admin());
end $$;

do $$
declare pol record;
begin
  execute 'alter table public.activity_bookings enable row level security';
  for pol in select policyname from pg_policies where schemaname='public' and tablename='activity_bookings' loop
    execute format('drop policy if exists %I on public.activity_bookings', pol.policyname);
  end loop;
  create policy "actbk_read" on public.activity_bookings for select
    using (customer_email = auth.email() or owner_email = auth.email() or public.is_admin());
  create policy "actbk_insert" on public.activity_bookings for insert
    with check (customer_email = auth.email() or public.is_admin());
  create policy "actbk_update" on public.activity_bookings for update
    using (customer_email = auth.email() or owner_email = auth.email() or public.is_admin())
    with check (customer_email = auth.email() or owner_email = auth.email() or public.is_admin());
  create policy "actbk_delete" on public.activity_bookings for delete
    using (owner_email = auth.email() or public.is_admin());
end $$;
