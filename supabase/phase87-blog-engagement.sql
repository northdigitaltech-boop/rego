-- ============================================================================
-- Phase 87 — Blog comments and likes
--
-- ADDITIVE AND IDEMPOTENT. Safe to re-run. Touches nothing existing.
--
-- ---------------------------------------------------------------------------
-- SIGN-IN IS REQUIRED FOR BOTH. HERE IS WHY.
--
-- LIKES: a counter anyone can increment is a vanity number. Without an
-- account behind each like it can be inflated from a script in seconds, and
-- once it can be, the number stops meaning anything to a reader. One like per
-- signed-in user per post is enforced by a UNIQUE constraint — not by hiding
-- the button after a click, which any user can undo.
--
-- COMMENTS: an open comment box on a public travel site is a spam magnet
-- within days. Requiring an account removes almost all drive-by spam without
-- any moderation queue, and it means a real name sits beside every opinion.
--
-- ---------------------------------------------------------------------------
-- COMMENTS ARE VISIBLE IMMEDIATELY, NOT PRE-MODERATED.
--
-- Pre-approval means a reader writes something, sees nothing, and does not
-- come back. On a new blog that kills the conversation before it starts.
--
-- Instead: sign-in required, admins can hide or delete anything, and a hidden
-- comment stays in the table so a mistake can be reversed. Deleting is a
-- separate, deliberate action.
-- ---------------------------------------------------------------------------
--
-- PREREQUISITES: phase29 (is_admin, profiles), phase85 (blog_posts)
-- ROLLBACK: bottom of file.
-- ============================================================================

do $$
begin
  if to_regclass('public.blog_posts') is null then
    raise exception 'public.blog_posts missing — run phase85-blog-news.sql first.';
  end if;
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'public.is_admin() missing — run phase29-auth-profiles.sql first.';
  end if;
end $$;


-- ============================================================================
-- 1. COMMENTS
-- ============================================================================
create table if not exists public.blog_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,

  /* The author. user_id is the identity; the name and avatar are copied at
     write time so a comment still reads correctly if the profile changes or
     the account is later removed. */
  user_id uuid not null,
  author_name text not null,
  author_avatar text,

  body text not null,

  /* One level of replies. Deliberately not a deep tree: nested threads past
     one level are hard to read on a phone and hard to moderate. */
  parent_id uuid references public.blog_comments(id) on delete cascade,

  /* Hidden rather than deleted, so moderation is reversible. */
  is_hidden boolean not null default false,
  hidden_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint blog_comment_body_not_blank check (btrim(body) <> ''),
  constraint blog_comment_body_length check (char_length(body) between 2 and 2000),
  constraint blog_comment_not_self_parent check (parent_id is null or parent_id <> id)
);

create index if not exists blog_comments_post_idx
  on public.blog_comments (post_id, created_at desc) where not is_hidden;
create index if not exists blog_comments_user_idx   on public.blog_comments (user_id);
create index if not exists blog_comments_parent_idx on public.blog_comments (parent_id);

create or replace function public.blog_comments_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists blog_comments_touch_trg on public.blog_comments;
create trigger blog_comments_touch_trg before update on public.blog_comments
  for each row execute function public.blog_comments_touch();


-- ---------------------------------------------------------------------------
-- Rate limit, in the database.
--
-- The UI can debounce and the API can throttle, but neither is the only path
-- to this table — a signed-in user with the anon key can POST directly. Ten
-- comments in five minutes is far above normal use and far below what a spam
-- script would want.
-- ---------------------------------------------------------------------------
create or replace function public.blog_comment_rate_limit()
returns trigger language plpgsql as $$
declare recent int;
begin
  select count(*) into recent
    from public.blog_comments
   where user_id = new.user_id
     and created_at > now() - interval '5 minutes';

  if recent >= 10 then
    raise exception 'Too many comments in a short time. Please wait a few minutes.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists blog_comment_rate_limit_trg on public.blog_comments;
create trigger blog_comment_rate_limit_trg before insert on public.blog_comments
  for each row execute function public.blog_comment_rate_limit();


-- ============================================================================
-- 2. LIKES
-- ============================================================================
create table if not exists public.blog_likes (
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  /* The whole guarantee: one like per user per post, enforced by the primary
     key. No amount of clicking, scripting or replaying can produce a second. */
  primary key (post_id, user_id)
);

create index if not exists blog_likes_post_idx on public.blog_likes (post_id);


-- ============================================================================
-- 3. RLS
--
-- Comments and likes are written by ORDINARY SIGNED-IN USERS, not admins, so
-- the policies are written around auth.uid() rather than is_admin().
--
-- The `with check (user_id = auth.uid())` clauses are the important part:
-- they make it impossible to post as somebody else, however the request is
-- constructed.
-- ============================================================================
alter table public.blog_comments enable row level security;
alter table public.blog_likes    enable row level security;

/* ---- comments ---- */

-- Anyone may read visible comments on a post they can already see. The join
-- matters: without it, comments on a scheduled post would leak its existence.
drop policy if exists blog_comments_public_read on public.blog_comments;
create policy blog_comments_public_read on public.blog_comments
  for select using (
    not is_hidden
    and exists (select 1 from public.blog_posts p where p.id = post_id)
  );

drop policy if exists blog_comments_admin_read on public.blog_comments;
create policy blog_comments_admin_read on public.blog_comments
  for select using (public.is_admin());

-- Post as yourself, on a visible post, only.
drop policy if exists blog_comments_insert on public.blog_comments;
create policy blog_comments_insert on public.blog_comments
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.blog_posts p where p.id = post_id)
  );

/* Edit your own comment, but you cannot un-hide one a moderator hid — the
   is_hidden check on both sides of the policy is what stops that. */
drop policy if exists blog_comments_own_update on public.blog_comments;
create policy blog_comments_own_update on public.blog_comments
  for update
  using (user_id = auth.uid() and not is_hidden)
  with check (user_id = auth.uid() and not is_hidden);

drop policy if exists blog_comments_own_delete on public.blog_comments;
create policy blog_comments_own_delete on public.blog_comments
  for delete using (user_id = auth.uid());

drop policy if exists blog_comments_admin_write on public.blog_comments;
create policy blog_comments_admin_write on public.blog_comments
  for all using (public.is_admin()) with check (public.is_admin());

/* ---- likes ---- */

drop policy if exists blog_likes_public_read on public.blog_likes;
create policy blog_likes_public_read on public.blog_likes
  for select using (true);

drop policy if exists blog_likes_insert on public.blog_likes;
create policy blog_likes_insert on public.blog_likes
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.blog_posts p where p.id = post_id)
  );

-- Unlike your own like. Nobody else's.
drop policy if exists blog_likes_delete on public.blog_likes;
create policy blog_likes_delete on public.blog_likes
  for delete using (user_id = auth.uid());


-- ============================================================================
-- 4. COUNTS
--
-- One call for the whole page. Counting likes and comments as two separate
-- round trips per post would be an N+1 the moment a list needs them.
-- ============================================================================
create or replace function public.blog_post_engagement(p_post_id uuid)
returns table (likes bigint, comments bigint, liked_by_me boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.blog_likes    l where l.post_id = p_post_id),
    (select count(*) from public.blog_comments c
      where c.post_id = p_post_id and not c.is_hidden),
    /* auth.uid() is null for a signed-out visitor, and null = anything is
       never true — so this is simply false for them. */
    exists (
      select 1 from public.blog_likes l
       where l.post_id = p_post_id and l.user_id = auth.uid()
    );
$$;

revoke all on function public.blog_post_engagement(uuid) from public;
grant execute on function public.blog_post_engagement(uuid) to anon, authenticated;


-- ============================================================================
-- 5. VERIFY
-- ============================================================================
do $$
declare n_c int; n_l int;
begin
  select count(*) into n_c from public.blog_comments;
  select count(*) into n_l from public.blog_likes;
  raise notice '--------------------------------------------';
  raise notice 'blog_comments : %', n_c;
  raise notice 'blog_likes    : %', n_l;
  raise notice '';
  raise notice 'Sign-in is required to comment or like.';
  raise notice 'Comments appear immediately; admins can hide or delete.';
  raise notice '--------------------------------------------';
end $$;


-- ============================================================================
-- ROLLBACK
-- ============================================================================
/*
drop trigger  if exists blog_comment_rate_limit_trg on public.blog_comments;
drop function if exists public.blog_comment_rate_limit();
drop trigger  if exists blog_comments_touch_trg on public.blog_comments;
drop function if exists public.blog_comments_touch();
drop function if exists public.blog_post_engagement(uuid);
drop table    if exists public.blog_likes;
drop table    if exists public.blog_comments;   -- WARNING: destroys discussion
*/
