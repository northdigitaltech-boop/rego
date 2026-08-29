-- ============================================================================
-- Before phase30b: will the public site still have anything on it?
-- ============================================================================
--
-- READ-ONLY, and a single statement. Creates nothing — no temp table, no
-- helper function — so it can be pasted and run on its own, and re-run, with
-- no state carried between runs.
--
-- TWO THINGS THE SUPABASE SQL EDITOR DOES THAT SHAPED THIS FILE
--   1. It never displays `raise notice`. A DO block that reports its findings
--      that way prints "Success. No rows returned." and throws the lot away —
--      worse than an error, because it reads as "checked, nothing wrong".
--   2. It pools connections, so a TEMP table created by one run is gone by the
--      next. Results have to arrive as rows from one statement.
--
--   Hence query_to_xml, which is the way to count rows in a table named by a
--   string without leaving plain SQL.
--
-- WHAT IT IS FOR
--   phase30b gives every listing table this read rule:
--
--       status = 'approved' or owner_email = auth.email() or public.is_admin()
--
--   Public pages are read with the anon key. An anonymous visitor has no
--   auth.email() and is not an admin, so for them it reduces to
--   status = 'approved'. That is the intended behaviour — unapproved listings
--   should not be public — and it is also the one way this can go badly. If
--   the live listings carry 'pending', 'active', 'Approved' with a capital A,
--   or null, the lockdown empties the public site, and it will look like a
--   breakage rather than a policy doing its job.
--
--   Read the verdict column. WOULD GO DARK must be dealt with before
--   phase30b runs, not after.
-- ============================================================================

with candidates(tbl) as (
  values ('hotels'),('homestays'),('hostels'),('tour_companies'),
         ('tour_packages'),('transports'),('tour_guides'),('media_providers'),
         ('restaurants'),('transport_providers'),('transport_services'),
         ('rental_vehicles'),('activities'),('coworking_spaces'),
         ('expedition_companies'),('roadside_providers')
),
present as (
  select c.tbl,
         exists (
           select 1 from information_schema.columns
           where table_schema = 'public' and table_name = c.tbl
             and column_name = 'status'
         ) as has_status
  from candidates c
  where to_regclass('public.' || c.tbl) is not null
),
counted as (
  select
    p.tbl,
    p.has_status,
    (xpath('/row/c/text()', query_to_xml(
      format('select count(*) as c from public.%I', p.tbl),
      false, true, '')))[1]::text::bigint as rows_total,
    case when p.has_status then
      (xpath('/row/c/text()', query_to_xml(
        format($q$select count(*) as c from public.%I where status = 'approved'$q$, p.tbl),
        false, true, '')))[1]::text::bigint
    else 0 end as approved,
    case when p.has_status then
      coalesce((xpath('/row/c/text()', query_to_xml(
        format($q$select coalesce(string_agg(distinct coalesce(status,'(null)'), ', '),
                                  '(no rows)') as c from public.%I$q$, p.tbl),
        false, true, '')))[1]::text, '(no rows)')
    else 'no status column' end as status_values
  from present p
)
select
  tbl                       as table_name,
  rows_total,
  approved                  as visible_to_public,
  status_values,
  case
    when rows_total = 0                  then 'empty — nothing to lose'
    when not has_status                  then 'WOULD GO DARK — no status column, so no public read'
    when approved = 0                    then 'WOULD GO DARK — no row says approved'
    when approved < rows_total           then 'ok — the rest were already not public'
    else                                      'ok — all visible'
  end                       as verdict
from counted
order by
  case when rows_total > 0 and approved = 0 then 0
       when rows_total = 0                  then 2
       else 1 end,
  tbl;
