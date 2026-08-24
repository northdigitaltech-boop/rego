-- ============================================================================
-- Phase 86 — Remove email addresses from public blog bylines
--
-- IDEMPOTENT. Safe to re-run. Touches only author_name, and only where it
-- currently holds an email address.
--
-- ---------------------------------------------------------------------------
-- THE BUG — MINE, FROM phase85
--
-- The create path fell back to the admin's email when their profile had no
-- full_name:
--
--     author_name: clean.author_name || p.full_name || p.email || "Rego"
--
-- author_name is printed on the public article page AND emitted inside
-- Article JSON-LD, so an admin without a full name had their personal email
-- published as the byline of every post they wrote — and left sitting in
-- structured data for scrapers.
--
-- The code no longer does this. This file cleans up what already shipped.
-- ---------------------------------------------------------------------------
--
-- PREREQUISITE: phase85-blog-news.sql
-- ROLLBACK: bottom of file — but you will not want it.
-- ============================================================================

do $$
declare
  n_fixed int;
  n_named int;
begin
  if to_regclass('public.blog_posts') is null then
    raise exception 'public.blog_posts missing — run phase85-blog-news.sql first.';
  end if;

  /* Where the author has a real name on their profile, use it. Better than a
     generic byline, and it is what the admin would have chosen. */
  update public.blog_posts b
     set author_name = btrim(p.full_name)
    from public.profiles p
   where b.author_id = p.id
     and b.author_name ~ '\S+@\S+\.\S+'
     and coalesce(btrim(p.full_name), '') <> '';
  get diagnostics n_named = row_count;

  /* Anything still holding an email gets the team byline. */
  update public.blog_posts
     set author_name = 'Rego Team'
   where author_name ~ '\S+@\S+\.\S+';
  get diagnostics n_fixed = row_count;

  raise notice '--------------------------------------------';
  raise notice 'Bylines replaced with a real profile name : %', n_named;
  raise notice 'Bylines replaced with "Rego Team"         : %', n_fixed;
  raise notice '--------------------------------------------';
end $$;


-- ============================================================================
-- STOP IT COMING BACK
--
-- A constraint rather than trusting every future write path. The API already
-- rejects it, but the API is not the only thing that can reach this column —
-- a migration, an import, or a future admin screen written in a hurry.
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'blog_author_name_not_email'
       and conrelid = 'public.blog_posts'::regclass
  ) then
    alter table public.blog_posts
      add constraint blog_author_name_not_email
      check (author_name is null or author_name !~ '\S+@\S+\.\S+');
    raise notice 'Added constraint: author_name cannot be an email address.';
  end if;
end $$;


-- ============================================================================
-- VERIFY — must return zero rows
-- ============================================================================
select id, slug, author_name
from public.blog_posts
where author_name ~ '\S+@\S+\.\S+';


-- ============================================================================
-- ROLLBACK
-- ============================================================================
/*
alter table public.blog_posts drop constraint if exists blog_author_name_not_email;
-- The original email bylines are not restored. That is deliberate.
*/
