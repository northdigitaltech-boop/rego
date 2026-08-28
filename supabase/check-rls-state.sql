-- ============================================================================
-- What is the actual row-level security on this database right now?
-- ============================================================================
--
-- READ-ONLY. Creates nothing, changes nothing, locks nothing.
--
-- WHY THIS EXISTS
--   public.is_admin() is missing. Twenty-nine migrations reference it, and
--   Postgres checks a function exists when a policy is CREATED, not when it
--   runs — so those policy statements should have failed. The site works
--   anyway, which means the truth is somewhere between "never ran" and "ran
--   fine", and guessing which is not good enough for a security question.
--
--   phase51 is the one migration with a fallback: where is_admin() is absent
--   it creates `using (true) with check (true)` instead — a policy that lets
--   anyone holding the anon key (which is public, it ships in the browser)
--   write the table. Section 3 finds every policy like that, whatever wrote
--   it.
--
-- Run all four sections and send the output back.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Does is_admin() exist at all, under any schema or signature?
-- ----------------------------------------------------------------------------
select
  n.nspname                       as schema,
  p.proname                       as function,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_userbyid(p.proowner)     as owner
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname in ('is_admin', 'handle_new_user')
order by n.nspname, p.proname;
-- No rows for is_admin → phase29 has genuinely never run.
-- A row in another schema → it exists but not where the policies look for it.


-- ----------------------------------------------------------------------------
-- 2. Every public table: is RLS on, and how many policies does it have?
--
-- The dangerous row is "RLS enabled, 0 policies" (nothing works except
-- service_role) or "RLS DISABLED" (the anon key can do anything).
-- ----------------------------------------------------------------------------
select
  c.relname as table_name,
  case when c.relrowsecurity then 'on' else 'OFF' end as rls,
  count(pol.polname)                                  as policies,
  case
    when not c.relrowsecurity                    then '⚠  open to the anon key'
    when count(pol.polname) = 0                  then '⚠  locked — only service_role'
    else 'ok'
  end as note
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy pol on pol.polrelid = c.oid
where n.nspname = 'public' and c.relkind = 'r'
group by c.relname, c.relrowsecurity
order by
  (case when not c.relrowsecurity then 0
        when count(pol.polname) = 0 then 1
        else 2 end),
  c.relname;


-- ----------------------------------------------------------------------------
-- 3. Policies that let anyone write.
--
-- A `using (true)` on SELECT is usually correct — public pages have to be
-- readable. On INSERT, UPDATE, DELETE or ALL it means the anon key can change
-- the data.
-- ----------------------------------------------------------------------------
select
  c.relname as table_name,
  pol.polname as policy,
  case pol.polcmd
    when 'r' then 'SELECT' when 'a' then 'INSERT'
    when 'w' then 'UPDATE' when 'd' then 'DELETE'
    else 'ALL' end as command,
  coalesce(pg_get_expr(pol.polqual, pol.polrelid), '—')       as using_expr,
  coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '—')  as with_check
from pg_policy pol
join pg_class c on c.oid = pol.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and pol.polcmd <> 'r'                       -- reads are usually meant to be open
  and (
    coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') in ('true')
    or coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') in ('true')
  )
order by c.relname, pol.polname;
-- Every row here is a table the anon key can write.


-- ----------------------------------------------------------------------------
-- 4. Do the profiles table and the admin role exist?
--    is_admin() reads profiles.role, so phase29 cannot work without them.
-- ----------------------------------------------------------------------------
select
  case when to_regclass('public.profiles') is null
       then 'profiles table does not exist'
       else 'profiles exists' end as profiles,
  case when to_regclass('public.profiles') is null then null
       else (select count(*) from public.profiles) end as total_rows,
  case when to_regclass('public.profiles') is null then null
       else (select count(*) from public.profiles where role = 'admin') end as admin_rows;
