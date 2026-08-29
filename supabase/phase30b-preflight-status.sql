-- ============================================================================
-- Before phase30b: will the public site still have anything on it?
-- ============================================================================
--
-- Read-only as far as your data is concerned. It builds one TEMP table, which
-- exists only for this connection and disappears when you close the tab.
--
-- WHY THE TEMP TABLE
--   The obvious way to write this is a DO block full of `raise notice`. The
--   Supabase SQL editor does not display notices at all — the query succeeds
--   and every line of output is silently discarded ("Success. No rows
--   returned."). Results only reach you as ROWS, so the loop collects its
--   findings into a table and the last statement selects them.
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
--   breakage rather than like a policy doing its job.
--
--   Read the `verdict` column. Anything that says WOULD GO DARK must be fixed
--   before phase30b runs, not after.
-- ============================================================================

drop table if exists pg_temp.preflight;
create temp table preflight (
  sort_key   int,
  kind       text,
  table_name text,
  rows_total bigint,
  visible    bigint,
  detail     text,
  verdict    text
);

do $$
declare
  t          text;
  n_total    bigint;
  n_ok       bigint;
  vals       text;
  has_status boolean;
  listings   text[] := array[
    'hotels','homestays','hostels','tour_companies','tour_packages','transports',
    'tour_guides','media_providers','restaurants','transport_providers',
    'transport_services','rental_vehicles','activities','coworking_spaces',
    'expedition_companies','roadside_providers'
  ];
  bookings   text[] := array[
    'bookings','homestay_bookings','hostel_bookings','tour_bookings',
    'transport_bookings','guide_bookings','media_bookings',
    'restaurant_bookings','activity_bookings','coworking_bookings'
  ];
begin
  ---------------------------------------------------------------- listings
  foreach t in array listings loop
    if to_regclass('public.' || t) is null then
      insert into preflight values (3, 'listing', t, null, null, null,
        'not in this database — phase30b skips it');
      continue;
    end if;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'status'
    ) into has_status;

    execute format('select count(*) from public.%I', t) into n_total;

    -- No status column: phase30b says so in a notice and grants no public
    -- read on the table. Worth surfacing, because the effect is the same as
    -- going dark.
    if not has_status then
      insert into preflight values (
        case when n_total > 0 then 0 else 2 end,
        'listing', t, n_total, 0, 'no status column',
        case when n_total > 0
             then 'WOULD GO DARK — phase30b grants no public read here'
             else 'empty' end);
      continue;
    end if;

    execute format(
      $q$select count(*) filter (where status = 'approved'),
                coalesce(string_agg(distinct coalesce(status, '(null)'), ', '), '(no rows)')
         from public.%I$q$, t)
      into n_ok, vals;

    insert into preflight values (
      case when n_total > 0 and n_ok = 0 then 0
           when n_total = 0              then 2
           else 1 end,
      'listing', t, n_total, n_ok, vals,
      case when n_total = 0        then 'empty — nothing to lose'
           when n_ok = 0           then 'WOULD GO DARK — no row says approved'
           when n_ok < n_total     then 'ok — the rest were already not public'
           else 'ok — all visible' end);
  end loop;

  ---------------------------------------------------------------- bookings
  -- phase30b's b_insert is `customer_email = auth.email() or is_admin()`, and
  -- b_read is the same plus the owner. Rows whose customer_email belongs to no
  -- account cannot be read back by anyone except an admin or the provider.
  foreach t in array bookings loop
    if to_regclass('public.' || t) is null then
      insert into preflight values (3, 'booking', t, null, null, null,
        'not in this database — phase30b skips it');
      continue;
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'customer_email'
    ) then
      execute format('select count(*) from public.%I', t) into n_total;
      insert into preflight values (0, 'booking', t, n_total, null,
        'no customer_email column', 'phase30b SKIPS this table — stays open');
      continue;
    end if;

    execute format(
      'select count(*), count(*) filter (where lower(customer_email) in
         (select lower(email) from auth.users)) from public.%I', t)
      into n_total, n_ok;

    insert into preflight values (
      case when n_total > 0 and n_ok < n_total then 1 else 2 end,
      'booking', t, n_total, n_ok,
      case when n_total = 0 then '—'
           else (n_total - n_ok)::text || ' with no matching account' end,
      case when n_total = 0            then 'empty'
           when n_ok = n_total         then 'ok — every booking has an account'
           else 'those rows become admin/provider-only' end);
  end loop;
end $$;

-- Worst first, so the problems are at the top of the result and you do not
-- have to scroll to find them.
select kind, table_name, rows_total, visible, detail, verdict
from preflight
order by sort_key, kind, table_name;
