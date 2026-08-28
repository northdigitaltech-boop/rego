-- ============================================================================
-- Where in this database does northdigitaltech@gmail.com appear?
-- ============================================================================
--
-- READ-ONLY. Creates nothing, changes nothing.
--
-- auth.users holds exactly one account, northdigitalsolution@gmail.com, with
-- no role in its metadata. But the admin account was set in Supabase — so
-- either it was set somewhere other than the Auth users list, or this is not
-- the project the live site runs on.
--
-- This searches every email-ish column in the database rather than guessing
-- which table to look in. It reports counts, never the rows themselves, so no
-- personal data is printed.
-- ============================================================================

do $$
declare
  r record;
  n bigint;
  found boolean := false;
begin
  for r in
    select c.table_schema, c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema in ('public', 'auth')
      and t.table_type = 'BASE TABLE'
      and c.data_type in ('text', 'character varying')
      and c.column_name ilike '%email%'
    order by c.table_schema, c.table_name, c.column_name
  loop
    begin
      execute format(
        'select count(*) from %I.%I where lower(%I) like %L',
        r.table_schema, r.table_name, r.column_name, '%northdigital%'
      ) into n;
    exception when others then
      continue;                       -- unreadable table: skip, do not abort
    end;

    if n > 0 then
      found := true;
      raise notice '% . % . %  →  % row(s)',
        r.table_schema, r.table_name, r.column_name, n;
    end if;
  end loop;

  if not found then
    raise notice 'Not found anywhere. No table in this project holds that address.';
  end if;
end $$;


-- ----------------------------------------------------------------------------
-- Every account this project knows about, and how it would be treated.
--
-- role_in_metadata is what auth-context.tsx falls back to when there is no
-- profiles row — which is the situation right now, because profiles is empty.
-- ----------------------------------------------------------------------------
select
  u.email,
  u.created_at::date                          as signed_up,
  u.raw_user_meta_data->>'role'               as role_in_metadata,
  (u.email_confirmed_at is not null)          as email_confirmed,
  coalesce(p.role, '(no profile row)')        as role_in_profiles
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at;


-- ----------------------------------------------------------------------------
-- Is this the project with the site's data in it?
--
-- If these counts are zero while the live site shows listings, the SQL editor
-- is pointed at a different project than the one Vercel uses.
--
-- Dynamic SQL, not `case when to_regclass(...) is null then ... else (select
-- count(*) from t) end`. That guard reads as though it protects the subquery,
-- and it does not: Postgres resolves every table name while parsing, before
-- any CASE branch is chosen, so a missing table aborts the whole statement.
-- Which is the very thing being tested for here.
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
  n bigint;
begin
  foreach t in array array[
    'listings', 'destinations', 'bookings', 'blog_posts',
    'locations', 'answers', 'platform_settings'
  ] loop
    if to_regclass('public.' || t) is null then
      raise notice '% — table does not exist', rpad(t, 20);
    else
      execute format('select count(*) from public.%I', t) into n;
      raise notice '% % row(s)', rpad(t, 20), n;
    end if;
  end loop;
end $$;
