-- ============================================================
-- Why a partner signup came out as a traveller.
--
-- Read-only. Nothing here changes a row — the repair is at the
-- bottom, commented out, so you can look before you touch.
--
-- Run the whole file in the Supabase SQL editor and read the
-- lines that start with >>>.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Is the signup trigger installed at all?
--
-- If it is missing, no profiles row is ever created and the app
-- falls back to auth metadata. Email signups would still show
-- the right role; Google ones would have nothing to fall back to.
-- ------------------------------------------------------------
do $$
declare has_insert boolean; has_guard boolean;
begin
  select exists (
    select 1 from pg_trigger t
     where t.tgrelid = 'auth.users'::regclass
       and not t.tgisinternal
       and t.tgname = 'on_auth_user_created'
  ) into has_insert;

  select exists (
    select 1 from pg_trigger t
     where t.tgrelid = 'public.profiles'::regclass
       and not t.tgisinternal
       and t.tgname = 'profiles_role_guard'
  ) into has_guard;

  raise notice '>>> signup trigger on auth.users : %',
    case when has_insert then 'PRESENT' else 'MISSING — profiles rows are not being created' end;
  raise notice '>>> role guard on profiles       : %',
    case when has_guard then 'PRESENT (browser role writes are rejected — this is the cause)'
         else 'ABSENT (phase130 has not been run here)' end;
end $$;

-- ------------------------------------------------------------
-- 2. Accounts that ASKED to be a partner but are not one.
--
-- raw_user_meta_data is what the signup form sent. profiles.role
-- is what the app actually reads. When they disagree, the person
-- is seeing the wrong dashboard.
-- ------------------------------------------------------------
do $$
declare n int;
begin
  select count(*) into n
    from auth.users u
    join public.profiles p on p.id = u.id
   where lower(coalesce(u.raw_user_meta_data->>'role','')) = 'partner'
     and lower(coalesce(p.role,'')) <> 'partner';
  raise notice '>>> asked for partner, stored as something else : %', n;
end $$;

select
  u.email,
  u.raw_user_meta_data->>'role'              as asked_for,
  p.role                                     as stored_as,
  u.raw_user_meta_data->>'business_category' as asked_category,
  p.business_category                        as stored_category,
  u.created_at,
  (u.raw_app_meta_data->>'provider')         as signed_up_with
from auth.users u
join public.profiles p on p.id = u.id
where lower(coalesce(u.raw_user_meta_data->>'role','')) = 'partner'
  and lower(coalesce(p.role,'')) <> 'partner'
order by u.created_at desc;

-- ------------------------------------------------------------
-- 3. Google accounts still sitting on the default role.
--
-- These are the ones RoleSetupGate was supposed to finish. Some
-- genuinely are travellers who chose Traveler; the ones to look
-- at are those whose metadata says partner (section 2) and those
-- that have a provider record but a customer role (section 4).
-- ------------------------------------------------------------
select
  u.email,
  p.role,
  (u.raw_app_meta_data->>'provider') as signed_up_with,
  (u.raw_user_meta_data ? 'role')    as ever_picked_a_role,
  u.created_at
from auth.users u
join public.profiles p on p.id = u.id
where lower(coalesce(p.role,'')) in ('customer','traveler')
  and coalesce(u.raw_app_meta_data->>'provider','email') <> 'email'
order by u.created_at desc
limit 100;

-- ------------------------------------------------------------
-- 4. The strongest evidence: someone who registered a BUSINESS
--    but whose account still says customer.
--
--    A traveller does not have a hotel. If this returns rows,
--    those people are locked out of their own provider dashboard.
-- ------------------------------------------------------------
do $$
declare
  t text;
  n int;
  total int := 0;
begin
  foreach t in array array[
    'hotels','homestays','hostels','tour_companies','transport_providers',
    'restaurants','media_providers','coworking_spaces'
  ] loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format($q$
      select count(*) from public.%I x
       join public.profiles p on lower(p.email) = lower(x.owner_email)
       where lower(coalesce(p.role,'')) in ('customer','traveler')
    $q$, t) into n;
    if n > 0 then
      raise notice '>>> %: % owner(s) whose account role is still customer', t, n;
    end if;
    total := total + n;
  end loop;
  raise notice '>>> business owners stuck on a traveller role (total): %', total;
end $$;

-- ============================================================
-- REPAIR — read section 2 and 4 first, then uncomment.
--
-- Runs as the service role in the SQL editor, so auth.uid() is
-- null and guard_profile_role_change() lets it through. That is
-- the same exemption /api/auth/choose-role relies on.
--
-- ROLLBACK: the previous value of every row it changes is printed
-- by section 2 above. Copy that output somewhere before running.
-- To undo a single account:
--     update public.profiles set role = 'customer'
--      where email = 'someone@example.com';
-- ============================================================

-- -- 4a. Honour what the person actually asked for at signup.
-- update public.profiles p
--    set role = 'partner',
--        business_category = coalesce(
--          p.business_category,
--          u.raw_user_meta_data->>'business_category'
--        )
--   from auth.users u
--  where u.id = p.id
--    and lower(coalesce(u.raw_user_meta_data->>'role','')) = 'partner'
--    and lower(coalesce(p.role,'')) <> 'partner';

-- -- 4b. One specific account, when you know the address.
-- update public.profiles
--    set role = 'partner', business_category = 'hotels'
--  where lower(email) = lower('someone@example.com');

-- -- Confirm afterwards:
-- select email, role, business_category from public.profiles
--  where lower(email) = lower('someone@example.com');
