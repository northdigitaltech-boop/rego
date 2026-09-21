-- ============================================================
-- Where does a rental vehicle stop?
--
-- Read-only. Nothing here changes a row.
--
-- A rental has to clear five gates before a traveller can book
-- it, and failing any one of them looks identical from outside:
-- "the rental section doesn't work". Each query below is one
-- gate, in order. The first one that answers badly is the cause;
-- stop there.
--
--   1. the table has the columns the form sends
--   2. rows exist at all
--   3. they are approved AND active
--   4. RLS lets a signed-out visitor read them
--   5. bookings can be written against them
-- ============================================================


-- ------------------------------------------------------------
-- GATE 1 — does the table match the form?
--
-- phase67 added transmission, ac, fuel_type and luggage_capacity.
-- The save form sends all four. If phase67 was never applied to
-- THIS database, every insert fails with "column does not exist"
-- and the provider sees a save that will not save — while the
-- rest of their dashboard works normally.
--
-- Expect four rows. Fewer means run phase67-transport-specs.sql.
-- ------------------------------------------------------------
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'rental_vehicles'
  and column_name in ('transmission', 'ac', 'fuel_type', 'luggage_capacity')
order by column_name;


-- ------------------------------------------------------------
-- GATE 2 + 3 — how many rentals are there, and what state?
--
-- `bookable` is the exact condition the public site uses:
-- status = 'approved' AND active = true. A rental that is
-- approved but inactive, or active but pending, is invisible.
--
-- All zero: nothing has been created — go back to gate 1.
-- Rows pending: they are waiting in admin Approvals.
-- ------------------------------------------------------------
select
  status,
  active,
  count(*) as rows,
  bool_or(status = 'approved' and active) as bookable
from public.rental_vehicles
group by status, active
order by status, active;

-- The rentals themselves, newest first.
select
  id,
  title,
  provider_name,
  owner_email,
  status,
  active,
  price_per_day,
  location,
  created_at
from public.rental_vehicles
order by created_at desc
limit 25;


-- ------------------------------------------------------------
-- GATE 4 — can a signed-out visitor actually read them?
--
-- Everything above runs as the owner of the SQL editor, which
-- bypasses nothing but sees everything an admin sees. This block
-- asks the question as `anon` — the role a traveller's browser
-- uses — and puts it back afterwards.
--
-- If the count here is 0 while the count above is not, the rows
-- exist and the read policy is what hides them.
-- ------------------------------------------------------------
do $$
declare n int;
begin
  set local role anon;
  select count(*) into n
    from public.rental_vehicles
   where status = 'approved' and active;
  reset role;
  raise notice 'a signed-out visitor can see % rental(s)', n;
end $$;

-- The policies in force, for reading alongside the result above.
select
  policyname,
  cmd,
  roles::text,
  qual        as using_expression,
  with_check  as check_expression
from pg_policies
where schemaname = 'public'
  and tablename  = 'rental_vehicles'
order by cmd, policyname;


-- ------------------------------------------------------------
-- GATE 5 — can a booking be written against a rental?
--
-- Rentals and transport services share transport_bookings, told
-- apart by listing_type. If services book and rentals do not,
-- compare the two counts: a zero on the rental side with a
-- non-zero on the service side points at the booking insert,
-- not at the listing.
-- ------------------------------------------------------------
select
  listing_type,
  count(*)            as bookings,
  max(created_at)     as most_recent
from public.transport_bookings
group by listing_type
order by listing_type;


-- ============================================================
-- WHAT THE ANSWERS MEAN
--
--   Gate 1 short          → run phase67-transport-specs.sql.
--                           Saving a rental is failing silently.
--   Gate 2 empty          → nothing was ever saved. Gate 1 again.
--   Gate 3 all 'pending'  → approve them in admin → Approvals.
--   Gate 3 active = false → the provider has them switched off.
--   Gate 4 zero           → the read policy is hiding them;
--                           compare with the transport_services
--                           policies, which are known to work.
--   Gate 5 no rental rows → the listing is fine and the booking
--                           write is the problem.
-- ============================================================
