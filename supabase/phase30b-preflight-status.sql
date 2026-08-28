-- ============================================================================
-- Before phase30b: will the public site still have anything on it?
-- ============================================================================
--
-- READ-ONLY. Creates nothing, changes nothing.
--
-- phase30b gives every listing table this read rule:
--
--     status = 'approved' or owner_email = auth.email() or public.is_admin()
--
-- Public pages are read with the anon key. An anonymous visitor has no
-- auth.email() and is not an admin, so for them the rule collapses to:
--
--     status = 'approved'
--
-- That is the intended behaviour — unapproved listings should not be public.
-- But it is only safe to apply if the listings that are live today actually
-- carry that exact string. If they are 'pending', 'active', 'Approved' with a
-- capital A, or null, the lockdown empties the site, and it will look like the
-- site broke rather than like a policy did its job.
--
-- Run this first. Every row where visible_to_public is 0 while total is not
-- is a table that would go dark.
-- ============================================================================

do $$
declare
  t          text;
  n_total    bigint;
  n_approved bigint;
  n_null     bigint;
  vals       text;
  tables     text[] := array[
    'hotels','homestays','hostels','tour_companies','tour_packages','transports',
    'tour_guides','media_providers','restaurants','transport_providers',
    'transport_services','rental_vehicles','activities','coworking_spaces',
    'expedition_companies','roadside_providers'
  ];
begin
  raise notice '%  %  %  %', rpad('table', 24), lpad('rows', 6), lpad('approved', 9), 'distinct status values';
  raise notice '%', repeat('-', 78);

  foreach t in array tables loop
    if to_regclass('public.' || t) is null then
      continue;                                   -- not in this database
    end if;

    -- No status column means phase30b grants no public read on this table at
    -- all (it says so in a notice). Worth seeing here too.
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'status'
    ) then
      execute format('select count(*) from public.%I', t) into n_total;
      raise notice '%  %  %  NO status COLUMN — phase30b grants no public read',
        rpad(t, 24), lpad(n_total::text, 6), lpad('-', 9);
      continue;
    end if;

    execute format(
      $q$select count(*), count(*) filter (where status = 'approved'),
                count(*) filter (where status is null),
                coalesce(string_agg(distinct coalesce(status, '(null)'), ', '), '(no rows)')
         from public.%I$q$, t)
      into n_total, n_approved, n_null, vals;

    raise notice '%  %  %  %',
      rpad(t, 24), lpad(n_total::text, 6), lpad(n_approved::text, 9), vals;

    if n_total > 0 and n_approved = 0 then
      raise notice '     ^^ WOULD GO DARK — % row(s), none approved', n_total;
    end if;
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- Bookings: can a traveller still create one after the lockdown?
--
-- phase30b's b_insert is `customer_email = auth.email() or public.is_admin()`.
-- The booking flow makes people sign up before booking, so customer_email
-- should already equal the signed-in address. Existing rows whose
-- customer_email does not appear in auth.users are the ones to look at: they
-- were made some other way, and their owners will not be able to read them
-- back.
-- ----------------------------------------------------------------------------
do $$
declare
  t        text;
  n_total  bigint;
  n_known  bigint;
  tables   text[] := array[
    'bookings','homestay_bookings','hostel_bookings','tour_bookings',
    'transport_bookings','guide_bookings','media_bookings',
    'restaurant_bookings','activity_bookings','coworking_bookings'
  ];
begin
  raise notice '';
  raise notice '%  %  %', rpad('booking table', 24), lpad('rows', 6), lpad('with a known account', 22);
  raise notice '%', repeat('-', 78);

  foreach t in array tables loop
    if to_regclass('public.' || t) is null then continue; end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'customer_email'
    ) then
      raise notice '%  — no customer_email column, phase30b will skip it', rpad(t, 24);
      continue;
    end if;

    execute format(
      'select count(*), count(*) filter (where lower(customer_email) in
         (select lower(email) from auth.users)) from public.%I', t)
      into n_total, n_known;

    raise notice '%  %  %', rpad(t, 24), lpad(n_total::text, 6), lpad(n_known::text, 22);
  end loop;
end $$;
