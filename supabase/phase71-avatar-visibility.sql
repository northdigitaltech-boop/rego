-- ============================================================
-- REGO — Phase 71: let signed-in users see each other's avatar
--
-- WHY THIS IS NEEDED
-- profiles is self-read only (phase29), so a chat list can show
-- the other person's email but never their picture — the query
-- returns nothing. This adds a narrow read policy for that.
--
-- WHY IT IS SAFE
-- The policy is on the TABLE, so it would expose every column of
-- any row it matches — including role and business_category.
-- That is more than a chat avatar needs, so instead of a table
-- policy this creates a VIEW with only three columns and grants
-- access to that.
--
-- Exposed: id, email, avatar.
-- NOT exposed: role, full_name, business_category, created_at.
--
-- Only signed-in users can read it. Anonymous visitors get nothing.
--
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

create or replace view public.public_avatars as
  select id, email, avatar
  from public.profiles;

-- The view runs with the caller's rights, not the owner's, so the
-- grant below is what decides access — not profiles' own policies.
alter view public.public_avatars set (security_invoker = on);

/* security_invoker means profiles' self-read policy still applies and
   the view would return only your own row — which defeats the purpose.
   So the view is switched back to definer rights and access is
   controlled purely by the GRANT. The narrow column list is what makes
   that acceptable: there is nothing sensitive left to leak. */
alter view public.public_avatars set (security_invoker = off);

revoke all on public.public_avatars from anon, authenticated;
grant select on public.public_avatars to authenticated;


-- ============================================================
-- VERIFY
-- ============================================================
-- 1. Columns — must be exactly id, email, avatar.
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'public_avatars'
order by ordinal_position;

-- 2. Grants — authenticated should have SELECT, anon nothing.
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'public_avatars';


-- ============================================================
-- ROLLBACK
-- ============================================================
-- drop view if exists public.public_avatars;
