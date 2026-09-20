-- ============================================================
-- Why is a Blog & News post not clickable / not opening?
--
-- Read-only. Nothing here changes a row. Run the whole file in
-- the Supabase SQL editor and read the four results in order.
--
-- The page markup is not the problem: every card wraps its image
-- and its title in a real <Link href="/blog-news/{slug}">. So a
-- post that does not open has something wrong with its slug or
-- its visibility, and each query below names one cause.
-- ============================================================


-- ------------------------------------------------------------
-- 1. ARE THE CONSTRAINTS EVEN THERE?
--
-- phase85 declares the slug `not null unique` with a format
-- CHECK, but inside `create table if not exists`. If blog_posts
-- already existed when that migration ran, Postgres skipped the
-- whole statement and NONE of those constraints were applied —
-- which is what makes queries 2 and 3 possible at all.
--
-- Expect one row per constraint. Missing rows are the answer.
-- ------------------------------------------------------------
select
  c.conname                     as constraint_name,
  pg_get_constraintdef(c.oid)   as definition
from pg_constraint c
where c.conrelid = 'public.blog_posts'::regclass
  and c.conname in ('blog_slug_format', 'blog_posts_slug_key')
union all
select
  i.indexname,
  i.indexdef
from pg_indexes i
where i.schemaname = 'public'
  and i.tablename  = 'blog_posts'
  and i.indexdef ilike '%unique%'
  and i.indexdef ilike '%slug%';


-- ------------------------------------------------------------
-- 2. DUPLICATE SLUGS  ← the most likely cause
--
-- Two posts sharing a slug used to take BOTH offline: the query
-- behind the article page asked for at most one row and got an
-- error instead, which the page read as "no such post" and
-- rendered as a 404. Meanwhile both kept appearing, and linking,
-- from the index — visible everywhere, openable nowhere.
--
-- The code no longer 404s on this (the newest post wins the URL),
-- but the older one is still unreachable until its slug changes.
--
-- Any row returned here needs a new slug.
-- ------------------------------------------------------------
select
  slug,
  count(*)                              as posts_sharing_it,
  string_agg(title, ' | ' order by created_at) as titles,
  string_agg(id::text, ' | ' order by created_at) as ids
from public.blog_posts
group by slug
having count(*) > 1;


-- ------------------------------------------------------------
-- 3. SLUGS THAT CANNOT BE A URL
--
-- A capital letter, a space, an apostrophe or a trailing hyphen
-- produces a link that does not resolve to the row it came from.
-- The admin form now normalises what you type, so this finds
-- historical rows only.
-- ------------------------------------------------------------
select
  id,
  title,
  slug,
  status,
  case
    when slug is null or btrim(slug) = '' then 'empty — link goes to the index, so the card looks dead'
    when slug <> lower(slug)              then 'has capitals'
    when slug ~ '\s'                      then 'has a space'
    when slug ~ '^-|-$'                   then 'starts or ends with a hyphen'
    when slug ~ '[^a-z0-9-]'              then 'has a character that is not a-z, 0-9 or -'
    else 'other'
  end as problem
from public.blog_posts
where slug is null
   or btrim(slug) = ''
   or slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$';


-- ------------------------------------------------------------
-- 4. POSTS THE PUBLIC CANNOT SEE
--
-- The read policy exposes a post only when:
--   status = 'published'  and coalesce(published_at, created_at) <= now()
--   status = 'scheduled'  and scheduled_at <= now()
--
-- Anything else is invisible to a signed-out reader. That is
-- correct behaviour, not a fault — but it explains a post you
-- can see in the admin list and cannot open in a normal tab.
--
-- Note `published_at` in the FUTURE: the status says published,
-- the date says not yet, and the post stays hidden with no
-- warning anywhere in the admin screen.
-- ------------------------------------------------------------
select
  id,
  title,
  slug,
  status,
  published_at,
  scheduled_at,
  case
    when status = 'draft'
      then 'draft — no public page until it is published'
    when status = 'scheduled' and (scheduled_at is null or scheduled_at > now())
      then 'scheduled for later — goes live on its own'
    when status = 'published' and coalesce(published_at, created_at) > now()
      then 'published_at is in the FUTURE — hidden until that moment'
    else 'visible'
  end as visibility
from public.blog_posts
where not (
  (status = 'published' and coalesce(published_at, created_at) <= now())
  or (status = 'scheduled' and scheduled_at is not null and scheduled_at <= now())
)
order by created_at desc;


-- ============================================================
-- FIXES — run only the one that matches what you found.
-- Each is written for a single post, by id, on purpose.
--
--   Duplicate or malformed slug (queries 2 and 3):
--     update public.blog_posts
--        set slug = 'a-new-unique-slug'
--      where id = 'PASTE-THE-ID';
--
--   published_at accidentally in the future (query 4):
--     update public.blog_posts
--        set published_at = now()
--      where id = 'PASTE-THE-ID';
--
-- Changing a slug changes the public URL, so anything already
-- linking to the old one stops resolving. For a post nobody has
-- shared yet that costs nothing.
-- ============================================================
