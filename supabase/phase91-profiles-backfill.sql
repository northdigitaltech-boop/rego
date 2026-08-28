-- ============================================================================
-- Phase 91: Give every existing user a profiles row, and name one admin.
-- ============================================================================
--
-- WHY THIS IS NEEDED
--   phase29 created public.profiles and a trigger, on_auth_user_created, that
--   writes a profile row whenever somebody signs up. A trigger only fires on
--   rows inserted after it exists — so every account created before phase29
--   ran has no profile. The table is empty.
--
--   That matters more than it sounds. public.is_admin() is:
--
--       select exists (select 1 from public.profiles
--                       where id = auth.uid() and role = 'admin')
--
--   With an empty table that returns false for everyone, always. Twenty-nine
--   migrations build their admin policies on that function. Running any of
--   them against an empty profiles table locks the admin dashboard against
--   its own owner — the policies would be correct and there would simply be
--   nobody they admit.
--
--   So this runs BEFORE re-running phase51 or any later phase.
--
-- WHAT IT DOES
--   1. Copies every existing auth.users row into profiles.
--   2. Promotes one named email to role = 'admin'.
--   3. Prints what it did, and refuses to finish quietly if there is still
--      no admin afterwards.
--
--   It reads the same four columns phase29's trigger already reads
--   (id, email, raw_user_meta_data, created_at), so no new assumption is
--   being made about the shape of auth.users.
--
-- SAFE TO RE-RUN. The insert is `on conflict (id) do nothing`; the promotion
-- is idempotent. It never deletes and never demotes.
--
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. Before. Look at this — it tells you what is about to be created.
-- ----------------------------------------------------------------------------
select
  (select count(*) from auth.users)                             as auth_users,
  (select count(*) from public.profiles)                        as profiles_now,
  (select count(*) from public.profiles where role = 'admin')   as admins_now;


-- ----------------------------------------------------------------------------
-- 1. Which accounts exist, and which are missing a profile.
--    Emails are shown because you need to recognise your own in step 2.
-- ----------------------------------------------------------------------------
select
  u.email,
  u.created_at::date as signed_up,
  coalesce(u.raw_user_meta_data->>'role', 'customer') as role_from_signup,
  case when p.id is null then '→ will be created' else 'already has one' end as profile
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at;


-- ----------------------------------------------------------------------------
-- 2. Backfill.
--
-- The role, name and category come from the metadata the signup form passed,
-- exactly as phase29's trigger reads them — so a business owner who signed up
-- as a partner stays a partner, and is not silently demoted to customer.
-- ----------------------------------------------------------------------------
insert into public.profiles (id, email, full_name, role, business_category, avatar, created_at)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', ''),
  coalesce(nullif(u.raw_user_meta_data->>'role', ''), 'customer'),
  u.raw_user_meta_data->>'business_category',
  u.raw_user_meta_data->>'avatar',
  u.created_at
from auth.users u
on conflict (id) do nothing;


-- ----------------------------------------------------------------------------
-- 3. Name the admin.
--
-- ►►► CHANGE THIS EMAIL if the account you sign in to REGO with is not this
--     one. It must be an email that appears in the list from step 1 — an
--     address you have never signed up with creates no row and no admin.
-- ----------------------------------------------------------------------------
update public.profiles
   set role = 'admin'
 where lower(email) = lower('northdigitalsolution@gmail.com');


-- ----------------------------------------------------------------------------
-- 4. Stop if it did not work.
--
-- Silence here would be the worst outcome: you would go on to run phase51,
-- the policies would tighten, and the dashboard would shut on you with no
-- clue why. Better to fail loudly, now, while nothing is locked.
-- ----------------------------------------------------------------------------
do $$
declare
  n_admins int;
  n_profiles int;
begin
  select count(*) into n_admins   from public.profiles where role = 'admin';
  select count(*) into n_profiles from public.profiles;

  if n_admins = 0 then
    raise exception
      'No admin was created. profiles has % row(s). The email in step 3 does not match any account in auth.users — check the list printed by step 1, put your real sign-in email in step 3, and run this again. Do NOT run phase51 until this passes.',
      n_profiles;
  end if;

  raise notice 'OK — % profile(s), % admin(s).', n_profiles, n_admins;
end $$;


-- ----------------------------------------------------------------------------
-- 5. After. This is the row that unlocks the admin dashboard.
-- ----------------------------------------------------------------------------
select email, role, created_at::date as signed_up
from public.profiles
order by (role = 'admin') desc, created_at;


-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- Undoes only the promotion — the profile rows themselves are what the app is
-- supposed to have, and deleting them would break sign-in for real users.
--
--   update public.profiles set role = 'customer'
--    where lower(email) = lower('northdigitalsolution@gmail.com');
--
-- To remove the backfilled rows as well (only sensible if phase29 itself is
-- being reverted — this signs everyone out of their role):
--
--   delete from public.profiles;
-- ============================================================================
