-- ============================================================================
-- Phase 85 — Blog & News
--
-- ADDITIVE AND IDEMPOTENT. Safe to re-run. Touches nothing existing.
--
-- ---------------------------------------------------------------------------
-- CONTENT IS MARKDOWN, NOT HTML — ON PURPOSE
--
-- `content` holds markdown, rendered by components/safarnama/story-markdown.tsx,
-- which builds React elements directly and never calls dangerouslySetInnerHTML.
--
-- Storing HTML from a WYSIWYG editor would mean either trusting the admin
-- completely or running a sanitiser on every render — and a sanitiser is a
-- filter that can be bypassed, whereas "we never parse HTML" cannot. The
-- renderer already exists and is already used for traveller stories, so the
-- blog gets the same guarantee for free.
-- ---------------------------------------------------------------------------
--
-- PREREQUISITE: phase29-auth-profiles.sql (public.is_admin)
-- ROLLBACK: bottom of file.
-- ============================================================================

do $$
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'public.is_admin() missing — run phase29-auth-profiles.sql first.';
  end if;
end $$;


-- ============================================================================
-- 1. TABLE
-- ============================================================================
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  -- Part of a public URL. Unique across the table, not per-anything.
  slug  text not null unique,

  excerpt text,
  /* Markdown. See the note above — never HTML. */
  content text not null,

  featured_image_url text,
  -- Screen readers and Google Images both need this. Not a keyword slot.
  image_alt text,

  -- travel-guides | destinations | tourism-news | safety-updates |
  -- events | rego-updates
  category text not null default 'rego-updates',
  tags text[] not null default '{}',

  author_id   uuid,
  author_name text,

  -- draft | scheduled | published
  status text not null default 'draft',
  is_featured boolean not null default false,

  scheduled_at timestamptz,
  published_at timestamptz,

  /* ---- SEO. All optional; the page falls back to the post's own fields. ---- */
  seo_title        text,
  meta_description text,
  canonical_url    text,
  og_title         text,
  og_description   text,
  og_image_url     text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint blog_status_valid check (status in ('draft','scheduled','published')),
  constraint blog_category_valid check (category in (
    'travel-guides','destinations','tourism-news','safety-updates','events','rego-updates'
  )),
  constraint blog_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint blog_title_not_blank check (btrim(title) <> ''),
  constraint blog_content_not_blank check (btrim(content) <> ''),

  /* A scheduled post with no date would sit invisible forever with no
     indication why. Enforced here, not only in the form. */
  constraint blog_scheduled_needs_date
    check (status <> 'scheduled' or scheduled_at is not null)
);

create index if not exists blog_posts_status_idx    on public.blog_posts (status);
create index if not exists blog_posts_category_idx  on public.blog_posts (category);
create index if not exists blog_posts_featured_idx  on public.blog_posts (is_featured) where is_featured;
create index if not exists blog_posts_published_idx on public.blog_posts (published_at desc)
  where status = 'published';
create index if not exists blog_posts_scheduled_idx on public.blog_posts (scheduled_at)
  where status = 'scheduled';
create index if not exists blog_posts_tags_idx      on public.blog_posts using gin (tags);


-- ---------------------------------------------------------------------------
-- updated_at, and published_at set once
-- ---------------------------------------------------------------------------
create or replace function public.blog_posts_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();

  /* Stamp the publication time the first time it goes live, and never move it
     afterwards. A published_at that shifts on every edit makes the article
     look newer than it is and breaks sitemap lastmod. */
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;

  return new;
end $$;

drop trigger if exists blog_posts_touch_trg on public.blog_posts;
create trigger blog_posts_touch_trg before insert or update on public.blog_posts
  for each row execute function public.blog_posts_touch();


-- ============================================================================
-- 2. SCHEDULED → PUBLISHED
--
-- A scheduled post becomes visible the moment its time passes. Rather than
-- needing a cron job to flip a flag, the public read path treats
-- "scheduled and the time has passed" as published — so a post goes live
-- exactly on time even if nothing has run.
--
-- This function tidies the status afterwards so the admin list is honest.
-- Safe to call often; called by the admin screen on load.
-- ============================================================================
create or replace function public.publish_due_posts()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare n int;
begin
  update public.blog_posts
     set status = 'published',
         published_at = coalesce(published_at, scheduled_at, now())
   where status = 'scheduled'
     and scheduled_at is not null
     and scheduled_at <= now();
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.publish_due_posts() from public;
grant execute on function public.publish_due_posts() to authenticated;


-- ============================================================================
-- 3. RLS
--
-- Public reads are allowed directly on the table — unlike answers, a blog post
-- has no draft/published nuance beyond what this policy expresses, and letting
-- the site query it directly keeps the list page a single fast request.
--
-- The policy is the whole guarantee, so it has to be exactly right:
-- published AND its time has arrived. A post scheduled for next week is
-- invisible even though its row exists.
-- ============================================================================
alter table public.blog_posts enable row level security;

drop policy if exists blog_public_read on public.blog_posts;
create policy blog_public_read on public.blog_posts
  for select
  using (
    (status = 'published' and coalesce(published_at, created_at) <= now())
    or (status = 'scheduled' and scheduled_at is not null and scheduled_at <= now())
  );

drop policy if exists blog_admin_read on public.blog_posts;
create policy blog_admin_read on public.blog_posts
  for select using (public.is_admin());

drop policy if exists blog_admin_write on public.blog_posts;
create policy blog_admin_write on public.blog_posts
  for all using (public.is_admin()) with check (public.is_admin());


-- ============================================================================
-- 4. VERIFY
-- ============================================================================
do $$
declare n int; n_pub int;
begin
  select count(*) into n from public.blog_posts;
  select count(*) into n_pub from public.blog_posts where status = 'published';
  raise notice '--------------------------------------------';
  raise notice 'blog_posts        : %', n;
  raise notice 'published         : %  (0 expected — nothing is seeded)', n_pub;
  raise notice '';
  raise notice 'Write posts in Admin -> Blog & News.';
  raise notice 'Content is MARKDOWN, rendered safely without HTML parsing.';
  raise notice '--------------------------------------------';
end $$;


-- ============================================================================
-- ROLLBACK
-- ============================================================================
/*
drop trigger  if exists blog_posts_touch_trg on public.blog_posts;
drop function if exists public.blog_posts_touch();
drop function if exists public.publish_due_posts();
drop table    if exists public.blog_posts;   -- WARNING: destroys every article
*/
