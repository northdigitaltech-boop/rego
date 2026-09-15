/* ============================================================
 * phase118 — flight_requests
 *
 * The concierge path: a traveller picks a flight on Rego, Rego's
 * team books it through the airline or a local agent, exactly as
 * they do today. No gateway, no PCC, no accreditation.
 *
 * WHY THIS IS NOT flight_orders
 *   flight_orders (a later phase) is for bookings Rego makes
 *   itself, with payment state, provider booking refs, ticket
 *   numbers and a state machine that spends money. This table is
 *   an ENQUIRY: a named person, an itinerary they liked, a price
 *   they saw, and a human who will call them back. Conflating the
 *   two would mean a request landing in a queue built to assume a
 *   payment had already cleared.
 *
 *   Same shape as the eleven existing Rego booking tables, and
 *   the expedition_bookings table from phase114: customer_email,
 *   status, and the phase93 cancellation columns.
 *
 * THE PRICE IS A SNAPSHOT, NOT A QUOTE
 *   quoted_total is what the customer was looking at when they
 *   asked. It is recorded so the team knows what was promised on
 *   screen, and it is explicitly NOT a price Rego is bound to —
 *   the fare is confirmed with the airline before anything is
 *   agreed. The UI says so in those words.
 *
 * NO PASSPORT DATA HERE, DELIBERATELY
 *   A request does not need it. Passport details are collected by
 *   whoever does the actual booking, through whatever channel they
 *   already use, and the retention question in
 *   docs/FLIGHTS_ARCHITECTURE.md §10 stays open rather than being
 *   answered by accident.
 *
 * ROLLBACK: at the bottom.
 * ============================================================ */

do $$
begin
  if to_regclass('public.flight_offers') is null then
    raise exception 'public.flight_offers is missing — run phase117 first.';
  end if;
end $$;


create table if not exists public.flight_requests (
  id              uuid primary key default gen_random_uuid(),

  /* Human-readable, for the customer to quote and support to search.
     Generated in the API so it is unique and predictable in format. */
  reference       text not null unique,

  /* Null for a signed-out visitor — asking should not require an account. */
  user_id         uuid references auth.users(id) on delete set null,

  /* The offer they chose. on delete set null because offers expire and get
     cleaned up, while the request must survive: itinerary_snapshot below is
     what the team actually works from. */
  offer_id        uuid references public.flight_offers(id) on delete set null,

  /* Everything needed to work the request without the offer row:
     carrier, flight numbers, airports, times, cabin, baggage. Denormalized
     on purpose — see above. */
  itinerary_snapshot jsonb not null,

  trip_type       text not null,
  origin          text not null,
  destination     text not null,
  departure_date  date not null,
  return_date     date,
  cabin           text not null,

  adults          int not null default 1,
  children        int not null default 0,
  infants         int not null default 0,

  /* What was on screen when they asked. NOT a commitment. */
  quoted_total    bigint,
  quoted_currency text,

  customer_name   text not null,
  customer_email  text not null,
  customer_phone  text not null,
  /* Free text: "flexible by a day either side", "need wheelchair assistance". */
  notes           text,

  status          text not null default 'new',
  /* What the team found when they actually looked. Filled in later. */
  agent_note      text,
  confirmed_total bigint,
  confirmed_currency text,
  /* The airline's PNR, once the team has booked it by hand. */
  airline_ref     text,

  handled_by      uuid references public.profiles(id),
  handled_at      timestamptz,

  /* phase93 columns, so the existing cancellation vocabulary applies here
     too rather than inventing a second one. */
  cancelled_by        text,
  cancelled_at        timestamptz,
  cancellation_reason text,
  cancellation_note   text,
  previous_status     text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint flight_requests_status check (status in
    ('new','contacted','quoted','confirmed','booked','declined','cancelled')),
  constraint flight_requests_trip_type check (trip_type in
    ('one_way','round_trip','multi_city')),
  constraint flight_requests_cabin check (cabin in
    ('economy','premium_economy','business','first')),
  constraint flight_requests_pax check (
    adults >= 1 and children >= 0 and infants >= 0 and infants <= adults
  ),
  constraint flight_requests_dates check (
    return_date is null or return_date >= departure_date
  )
);

create index if not exists flight_requests_user_idx on public.flight_requests (user_id, created_at desc);
create index if not exists flight_requests_status_idx on public.flight_requests (status, created_at desc);
create index if not exists flight_requests_email_idx on public.flight_requests (customer_email);
create index if not exists flight_requests_ref_idx on public.flight_requests (reference);

/* Defined here as well as in phase116/117 — a migration must not depend on
   which revision of an earlier one was applied. */
create or replace function public.touch_flight_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end $fn$;

drop trigger if exists trg_flight_requests_touch on public.flight_requests;
create trigger trg_flight_requests_touch before update on public.flight_requests
  for each row execute function public.touch_flight_updated_at();


/* ============================================================
 * RLS
 *
 * WRITES ARE SERVER-SIDE ONLY. No insert or update policy exists,
 * so under RLS the client cannot write at all — the API route
 * writes with the service-role key. That is what stops a request
 * being filed with someone else's name, or a customer editing
 * their own status to "confirmed".
 * ============================================================ */
alter table public.flight_requests enable row level security;

/* A signed-in person sees their own requests, matched on user_id.

   NOT on customer_email: a person can type any address into the form, so
   matching on it would let somebody read a stranger's request by entering
   their address. A signed-out request is found through the reference and
   the confirmation email instead. */
drop policy if exists flight_requests_own_read on public.flight_requests;
create policy flight_requests_own_read on public.flight_requests
  for select to authenticated using (user_id = auth.uid());

drop policy if exists flight_requests_admin_read on public.flight_requests;
create policy flight_requests_admin_read on public.flight_requests
  for select to authenticated using (public.is_admin());

/* Admins work the queue through the API, but the policy is here so an admin
   screen reading directly still sees everything. */
drop policy if exists flight_requests_admin_write on public.flight_requests;
create policy flight_requests_admin_write on public.flight_requests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.flight_requests to authenticated;


select
  (select count(*) from public.flight_requests) as requests,
  'Empty. Requests arrive from /flights/offer/[id].' as note;


/* ------------------------------------------------------------------
 * ROLLBACK
 *
 * This table holds real customer enquiries once it is live — people
 * waiting for a call back. Check before dropping:
 *
 *   select count(*) from public.flight_requests where status <> 'booked';
 *
 * Then, only if that is zero or the rows are genuinely disposable:
 *
 *   -- drop table if exists public.flight_requests;
 * ------------------------------------------------------------------ */
