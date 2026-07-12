-- ============================================================
-- REGO — Phase 43: Safarnama — Traveler Stories
-- Community travel stories about Gilgit-Baltistan. Travellers publish a story
-- (pending → admin-approved), readers like / comment / view. Like & comment
-- counts are kept denormalised via SECURITY DEFINER triggers; views bump via
-- an RPC so any reader can increment safely under RLS.
-- Security-first RLS (public / owner / admin), matching phase40/42.
-- Requires phase29 (is_admin).
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

/* ---------------- Stories ---------------- */
create table if not exists public.stories (
  id                  uuid primary key default gen_random_uuid(),
  owner_email         text,
  author_name         text,
  author_avatar       text,
  title               text not null,
  cover_image         text,
  destination         text,
  city                text,
  trip_date           date,
  duration            text,
  travel_type         text,        -- road-trip | family | solo | adventure | budget | ...
  budget              text,
  transportation      text,
  hotels              text[],
  places_visited      text[],
  restaurants         text[],
  best_experience     text,
  problems_faced      text,
  travel_tips         text,
  road_condition      text,
  food_recommendations text,
  story               text,        -- full body
  preview             text,        -- short preview
  gallery             text[],
  videos              text[],
  timeline            jsonb,       -- [{ title, date, note }]
  budget_breakdown    jsonb,       -- [{ label, amount }]
  rating              numeric not null default 0,
  reading_time        int not null default 1,
  likes               int not null default 0,
  comments            int not null default 0,
  views               int not null default 0,
  verified            boolean not null default false,
  featured            boolean not null default false,
  status              text not null default 'pending', -- pending | approved | rejected
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
create index if not exists stories_status_idx on public.stories (status);
create index if not exists stories_type_idx on public.stories (travel_type);
create index if not exists stories_city_idx on public.stories (city);
create index if not exists stories_owner_idx on public.stories (owner_email);

/* ---------------- Comments ---------------- */
create table if not exists public.story_comments (
  id          uuid primary key default gen_random_uuid(),
  story_id    uuid references public.stories(id) on delete cascade,
  user_email  text not null,
  user_name   text,
  user_avatar text,
  text        text not null,
  hidden      boolean not null default false,
  created_at  timestamptz default now()
);
create index if not exists story_comments_story_idx on public.story_comments (story_id);

/* ---------------- Likes ---------------- */
create table if not exists public.story_likes (
  id         uuid primary key default gen_random_uuid(),
  story_id   uuid references public.stories(id) on delete cascade,
  user_email text not null,
  created_at timestamptz default now()
);
create unique index if not exists story_likes_uidx on public.story_likes (story_id, user_email);

/* ---------------- Denormalised counters (SECURITY DEFINER triggers) ---------------- */
create or replace function public.sync_story_likes()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.stories set likes = likes + 1 where id = new.story_id;
  elsif tg_op = 'DELETE' then
    update public.stories set likes = greatest(0, likes - 1) where id = old.story_id;
  end if;
  return null;
end $$;
drop trigger if exists trg_story_likes on public.story_likes;
create trigger trg_story_likes after insert or delete on public.story_likes
  for each row execute function public.sync_story_likes();

create or replace function public.sync_story_comments()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.stories set comments = comments + 1 where id = new.story_id;
  elsif tg_op = 'DELETE' then
    update public.stories set comments = greatest(0, comments - 1) where id = old.story_id;
  end if;
  return null;
end $$;
drop trigger if exists trg_story_comments on public.story_comments;
create trigger trg_story_comments after insert or delete on public.story_comments
  for each row execute function public.sync_story_comments();

-- Public view bump (any reader can call; RLS-safe via definer).
create or replace function public.bump_story_views(p_story uuid)
  returns void language sql security definer set search_path = public as $$
  update public.stories set views = views + 1 where id = p_story and status = 'approved';
$$;

/* ---------------- RLS ---------------- */

-- Stories: public reads approved; owner reads/manages own; admin everything.
do $$
declare pol record;
begin
  execute 'alter table public.stories enable row level security';
  for pol in select policyname from pg_policies where schemaname='public' and tablename='stories' loop
    execute format('drop policy if exists %I on public.stories', pol.policyname);
  end loop;
  create policy "st_read" on public.stories for select
    using (status = 'approved' or owner_email = auth.email() or public.is_admin());
  create policy "st_insert" on public.stories for insert
    with check (owner_email = auth.email() or public.is_admin());
  create policy "st_update" on public.stories for update
    using (owner_email = auth.email() or public.is_admin())
    with check (owner_email = auth.email() or public.is_admin());
  create policy "st_delete" on public.stories for delete
    using (owner_email = auth.email() or public.is_admin());
end $$;

-- Comments: public reads visible; signed-in inserts own; commenter/admin delete; admin hides.
do $$
declare pol record;
begin
  execute 'alter table public.story_comments enable row level security';
  for pol in select policyname from pg_policies where schemaname='public' and tablename='story_comments' loop
    execute format('drop policy if exists %I on public.story_comments', pol.policyname);
  end loop;
  create policy "sc_read" on public.story_comments for select
    using (hidden = false or user_email = auth.email() or public.is_admin());
  create policy "sc_insert" on public.story_comments for insert
    with check (user_email = auth.email());
  create policy "sc_update" on public.story_comments for update
    using (public.is_admin()) with check (public.is_admin());
  create policy "sc_delete" on public.story_comments for delete
    using (user_email = auth.email() or public.is_admin());
end $$;

-- Likes: user manages own; admin can read.
do $$
declare pol record;
begin
  execute 'alter table public.story_likes enable row level security';
  for pol in select policyname from pg_policies where schemaname='public' and tablename='story_likes' loop
    execute format('drop policy if exists %I on public.story_likes', pol.policyname);
  end loop;
  create policy "sl_read" on public.story_likes for select
    using (user_email = auth.email() or public.is_admin());
  create policy "sl_insert" on public.story_likes for insert
    with check (user_email = auth.email());
  create policy "sl_delete" on public.story_likes for delete
    using (user_email = auth.email());
end $$;
