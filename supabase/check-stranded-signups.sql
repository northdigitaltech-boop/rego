-- ============================================================
-- Accounts created by the signup bug — real, and unused.
--
-- Read-only. Nothing here changes a row.
--
-- WHAT HAPPENED
--   signUp() succeeded and created the account, then the code
--   immediately called sign-in again. Supabase enforces captcha
--   on that second call too, and the Turnstile token had already
--   been spent on the signup — so it came back
--   "400 captcha protection: request disallowed", and the person
--   was told the security check failed.
--
--   The account was there the whole time. Trying the same
--   address again then answered "User already registered",
--   which is why a brand-new Gmail looks like it is taken.
--
--   Google sign-in was unaffected: it never touches the password
--   endpoint, so there was no captcha to spend. That is exactly
--   why "with Google it works" — it is the signature of this bug,
--   not a separate problem.
--
-- The fix is in the code. This finds the people already stranded
-- by it, so they can be told to sign in rather than sign up.
-- ============================================================


-- ------------------------------------------------------------
-- 1. WHO IS STRANDED
--
-- Created an account, never once signed in. A password signup
-- that hit the bug looks exactly like this.
--
-- `providers` distinguishes them: an account made with Google
-- shows 'google' and is fine. Look at the 'email' rows.
-- ------------------------------------------------------------
select
  u.email,
  u.created_at,
  u.email_confirmed_at,
  u.raw_app_meta_data ->> 'providers'          as sign_in_methods,
  u.raw_user_meta_data ->> 'role'              as signed_up_as,
  u.raw_user_meta_data ->> 'business_category' as category,
  p.role                                       as profile_role
from auth.users u
left join public.profiles p on lower(p.email) = lower(u.email)
where u.last_sign_in_at is null
order by u.created_at desc;


-- ------------------------------------------------------------
-- 2. STRANDED PARTNERS SPECIFICALLY
--
-- These are the ones worth contacting: they meant to list a
-- business, believe the signup failed, and have an account
-- sitting ready with the right role on it.
-- ------------------------------------------------------------
select
  u.email,
  u.created_at,
  u.raw_user_meta_data ->> 'full_name'         as name,
  u.raw_user_meta_data ->> 'business_category' as category
from auth.users u
where u.last_sign_in_at is null
  and u.raw_user_meta_data ->> 'role' = 'partner'
  and coalesce(u.raw_app_meta_data ->> 'providers', '') not like '%google%'
order by u.created_at desc;


-- ------------------------------------------------------------
-- 3. DID THE PROFILE ROW GET MADE?
--
-- The signup trigger writes public.profiles. If an account from
-- query 1 has no profile row, that is a separate problem and the
-- person will land on a broken dashboard when they do sign in.
--
-- No rows returned = every account has its profile. Good.
-- ------------------------------------------------------------
select
  u.email,
  u.created_at,
  'auth.users row with no matching public.profiles row' as problem
from auth.users u
left join public.profiles p on lower(p.email) = lower(u.email)
where p.id is null
order by u.created_at desc;


-- ============================================================
-- WHAT TO DO WITH THE RESULT
--
-- Nothing needs deleting. Each account is real and correct —
-- the password the person chose was saved with it, so they can
-- sign in today.
--
-- Tell anyone in query 2 to use Sign in, not Sign up. If they do
-- not remember the password, "Forgot password" on the sign-in
-- page sends them a link, and Continue with Google works on the
-- same address.
--
-- Do NOT delete an account to "let them sign up again": it would
-- take their listings and bookings with it, and signing in works
-- now anyway.
-- ============================================================
