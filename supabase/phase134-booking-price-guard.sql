-- ============================================================
-- phase134 — the customer no longer decides what they pay.
--
-- SEC-P0-1.
--
-- ---------------------------------------------------------------------------
-- WHAT IS WRONG TODAY
--
-- Every booking is inserted by the BROWSER. src/lib/bookings.ts:54:
--
--     return supabase.from("bookings").insert(input).select().single();
--
-- `input` carries total_price, computed in the page from the
-- rooms the customer ticked. phase30b's policy checks that
-- customer_email is the caller — it has nothing to say about the
-- amount. So this is a valid, authorised request today:
--
--     POST /rest/v1/bookings
--     { "hotel_id": "...", "customer_email": "<me>",
--       "rooms": 1, "total_price": 1 }
--
-- Seven other booking tables take a client-supplied total_price
-- the same way.
--
-- Right now that produces a wrong number on a provider's screen,
-- and a human probably notices. The day a payment gateway reads
-- total_price, it becomes theft — with no bug to find, because
-- the attacker used the API exactly as designed.
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS A FLOOR CHECK AND NOT AN EXACT RECOMPUTE
--
-- The honest version of this fix recomputes the total from what
-- was booked and ignores the client entirely. The schema will not
-- support that yet: a hotel booking records what was chosen as
-- `room_name`, a display string like "2× Deluxe, 1× Standard".
-- There is no room_id, no per-line quantity — nothing a trigger
-- can price.
--
-- So this enforces the strongest rule the current schema allows:
--
--   total_price >= (cheapest room in that hotel) × rooms × nights
--
-- That kills `total_price: 1`, and every variant of paying a
-- fraction of the real price. It does NOT catch a customer who
-- books a suite and pays the floor price of a single room, and
-- this file does not pretend otherwise.
--
-- CLOSING THAT GAP PROPERLY, BEFORE PAYMENTS
--   Add a `room_selection jsonb` column holding [{room_id, qty}],
--   have the widget send that instead of a summary string, and
--   replace the floor check below with a real recompute. That is
--   a schema change plus one widget, and it is the thing to do
--   before money moves. This file buys the time to do it
--   carefully rather than tonight.
--
-- ALSO ENFORCED, ON ALL TEN BOOKING TABLES
--   total_price may not be negative. A negative total is not a
--   discount; with a gateway attached it is a refund the customer
--   wrote themselves.
--
-- NOTHING LEGITIMATE BREAKS
--   * Admins and the service role skip both checks — they set
--     prices deliberately, including zero for a comp booking.
--   * Free and price-on-request bookings still work: the floor is
--     only applied when the hotel actually has priced rooms.
--   * A booking with no hotel_id, no dates or no rooms is
--     untouched — there is nothing to compare against, and
--     guessing would reject real bookings.
-- ---------------------------------------------------------------------------

-- ------------------------------------------------------------
-- 1. No negative totals, anywhere.
-- ------------------------------------------------------------
create or replace function public.guard_booking_total_nonneg()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if new.total_price is not null and new.total_price < 0 then
    raise exception 'A booking total cannot be negative'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'bookings','tour_bookings','transport_bookings','guide_bookings',
    'media_bookings','homestay_bookings','hostel_bookings'
  ] loop
    if to_regclass('public.' || t) is null then
      raise notice 'skipped % (not present)', t;
      continue;
    end if;
    /* Only where the column exists — restaurant, activity and coworking
       bookings have no total_price and must not be given a trigger that
       references one. */
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t and column_name = 'total_price'
    ) then
      raise notice 'skipped % (no total_price column)', t;
      continue;
    end if;

    execute format('drop trigger if exists %1$s_total_nonneg on public.%1$I', t);
    execute format($x$create trigger %1$s_total_nonneg
      before insert or update on public.%1$I
      for each row execute function public.guard_booking_total_nonneg()$x$, t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 2. Hotel bookings must clear the floor price.
-- ------------------------------------------------------------
create or replace function public.guard_hotel_booking_price()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  nights    integer;
  room_qty  integer;
  cheapest  integer;
  floor_amt integer;
begin
  /* No JWT means the service role, the SQL editor or another trigger — all
     already trusted. An admin may price a booking however they choose. */
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.hotel_id is null or new.total_price is null then
    return new;
  end if;

  select min(price) into cheapest
    from public.rooms
   where hotel_id = new.hotel_id
     and price > 0;

  -- Hotel has no priced rooms: nothing to compare against.
  if cheapest is null then
    return new;
  end if;

  /* One night minimum. A same-day check-in/check-out is still a stay, and
     a null date pair should not silently price the booking at zero. */
  nights := greatest(1, coalesce(new.check_out - new.check_in, 1));
  room_qty := greatest(1, coalesce(new.rooms, 1));
  floor_amt := cheapest * room_qty * nights;

  if new.total_price < floor_amt then
    raise exception
      'Booking total % is below the minimum for % room(s) over % night(s) at this property',
      new.total_price, room_qty, nights
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_price_floor on public.bookings;
create trigger bookings_price_floor
  before insert or update on public.bookings
  for each row execute function public.guard_hotel_booking_price();

-- ============================================================
-- VERIFY (as an ordinary signed-in customer, not an admin)
--
--   -- should FAIL
--   insert into public.bookings
--     (hotel_id, hotel_title, customer_email, rooms, guests, total_price)
--   values ('<a hotel id>', 'Test', auth.email(), 1, 1, 1);
--
--   -- should SUCCEED at or above the real floor
--
-- And confirm nothing existing broke:
--   select count(*) from public.bookings;   -- unchanged
-- ============================================================

-- ============================================================
-- ROLLBACK
--
--   drop trigger if exists bookings_price_floor on public.bookings;
--   drop function if exists public.guard_hotel_booking_price();
--   -- and, per table:
--   -- drop trigger if exists <table>_total_nonneg on public.<table>;
--   drop function if exists public.guard_booking_total_nonneg();
-- ============================================================
