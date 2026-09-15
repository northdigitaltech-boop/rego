/* ============================================================
 * phase117 — searches, offers and markup rules
 *
 * Phase 2 of the Flights module. Still no orders, no passengers,
 * no payments — nothing here can take money or hold personal data
 * beyond a search log.
 *
 * WHY OFFERS ARE STORED SERVER-SIDE AT ALL
 *   The detail page and the reprice step both need the exact offer
 *   the customer clicked. Keeping it in the browser would mean
 *   trusting the client's copy of a price — which is the one thing
 *   a booking flow must never do. The offer id in the URL resolves
 *   against this table, and the price that gets repriced is the
 *   price REGO recorded, not the one the page is holding.
 *
 * WHY THEY EXPIRE
 *   A fare is a quote with a clock on it. `expires_at` is enforced
 *   on read: an expired offer is not "old data to refresh", it is
 *   a price nobody is willing to honour, and the UI must send the
 *   customer back to results rather than carry it forward.
 *
 * ROLLBACK: at the bottom.
 * ============================================================ */

do $$
begin
  if to_regclass('public.airports') is null then
    raise exception 'public.airports is missing — run phase116-flights-reference-data.sql first.';
  end if;
end $$;

/* Defined here as well as in phase116, on purpose.
   A migration must not depend on WHICH REVISION of an earlier migration was
   run. An early phase116 created this function under a different name, and a
   database that had it produced "42883: function does not exist" here —
   which is a versioning problem masquerading as a missing dependency.
   `create or replace` with an identical body is idempotent, so defining it
   in both files costs nothing and removes the ordering trap entirely. */
create or replace function public.touch_flight_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end $fn$;


/* ============================================================
 * SEARCHES — an audit and analytics trail, not a cache key
 * ============================================================ */
create table if not exists public.flight_searches (
  id             uuid primary key default gen_random_uuid(),

  /* Null for a signed-out visitor. Searching does not require an account. */
  user_id        uuid references auth.users(id) on delete set null,

  trip_type      text not null,
  origin         text not null,
  destination    text not null,
  departure_date date not null,
  return_date    date,

  adults         int not null default 1,
  children       int not null default 0,
  infants        int not null default 0,
  cabin          text not null,
  currency       text not null default 'PKR',

  provider       text not null,
  result_count   int not null default 0,
  /* Round trip to the provider, for spotting a GDS getting slow. */
  duration_ms    int,
  /* Set when the search failed. Kind only — never a raw provider payload. */
  error_kind     text,

  correlation_id text not null,
  created_at     timestamptz not null default now(),

  constraint flight_searches_trip_type check (trip_type in ('one_way','round_trip','multi_city')),
  constraint flight_searches_cabin check (cabin in ('economy','premium_economy','business','first')),
  constraint flight_searches_pax check (adults >= 1 and children >= 0 and infants >= 0 and infants <= adults)
);

create index if not exists flight_searches_user_idx on public.flight_searches (user_id, created_at desc);
create index if not exists flight_searches_route_idx on public.flight_searches (origin, destination, departure_date);
create index if not exists flight_searches_corr_idx on public.flight_searches (correlation_id);


/* ============================================================
 * OFFERS
 * ============================================================ */
create table if not exists public.flight_offers (
  id                  uuid primary key default gen_random_uuid(),
  search_id           uuid references public.flight_searches(id) on delete cascade,

  provider            text not null,
  provider_offer_id   text not null,

  /* The normalized FlightOffer, exactly as the app models it. Denormalized on
     purpose: when a provider expires an offer we still need to render what
     the customer looked at. */
  offer               jsonb not null,

  /* Lifted out of the jsonb so filtering and sorting are index-backed rather
     than a jsonb scan across every offer in a busy search. */
  validating_carrier  text not null,
  origin              text not null,
  destination         text not null,
  departure_at        timestamptz not null,
  arrival_at          timestamptz not null,
  duration_minutes    int not null,
  stop_count          int not null default 0,
  cabin               text not null,

  provider_base_fare  bigint not null,
  provider_tax        bigint not null,
  rego_markup         bigint not null default 0,
  rego_service_fee    bigint not null default 0,
  customer_total      bigint not null,
  currency            text not null,
  markup_rule_ids     text[] not null default '{}',

  /* True for anything MockFlightProvider produced. Carried into the database
     so a mock offer can never be mistaken for real inventory later. */
  is_mock             boolean not null default false,

  expires_at          timestamptz not null,
  created_at          timestamptz not null default now(),

  constraint flight_offers_cabin check (cabin in ('economy','premium_economy','business','first')),
  constraint flight_offers_amounts check (
    provider_base_fare >= 0 and provider_tax >= 0
    and rego_markup >= 0 and rego_service_fee >= 0 and customer_total >= 0
  )
);

create index if not exists flight_offers_search_idx on public.flight_offers (search_id);

/* Plain index on expires_at, NOT a partial index.
   `... where expires_at > now()` is the obvious thing to write and Postgres
   refuses it: 42P17, "functions in index predicate must be marked
   IMMUTABLE". now() is STABLE — it changes between statements — so an index
   built on it could never stay correct. A plain b-tree on expires_at answers
   the same `expires_at > now()` queries at this table's size. */
create index if not exists flight_offers_live_idx on public.flight_offers (expires_at);

create index if not exists flight_offers_route_idx on public.flight_offers (origin, destination, departure_at);


/* ============================================================
 * MARKUP RULES
 *
 * The engine is src/lib/flights/markup.ts and is pure. These rows
 * are its only input. Conflict resolution lives in the engine, not
 * in SQL, so it can be unit-tested without a database.
 * ============================================================ */
create table if not exists public.flight_markup_rules (
  id           uuid primary key default gen_random_uuid(),

  scope        text not null,
  /* Airline → 'PK'. Route → 'KUL-ISB'. Cabin → 'business'. Provider → 'mock'.
     Null for all / international / domestic. */
  match_value  text,

  kind         text not null,
  /* Percent: 2.5 means 2.5%. Fixed: MINOR UNITS, like every amount here. */
  value        numeric(12,4) not null,
  currency     text,

  /* Higher wins; the engine falls through to specificity on a tie. */
  priority     int not null default 0,
  is_active    boolean not null default true,
  starts_at    timestamptz,
  ends_at      timestamptz,
  label        text,

  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint fmr_scope check (scope in
    ('all','airline','route','international','domestic','cabin','provider')),
  constraint fmr_kind check (kind in ('percent','fixed')),
  constraint fmr_value_sane check (value >= 0),

  /* A percentage over 100 is a typo, not a pricing strategy. Caught here
     because the cost of the mistake is every fare on the site. */
  constraint fmr_percent_range check (kind <> 'percent' or value <= 100),

  /* A fixed rule with no currency cannot be applied to anything. */
  constraint fmr_fixed_currency check (kind <> 'fixed' or currency is not null),

  /* The scopes that need a target must have one. */
  constraint fmr_match_required check (
    scope in ('all','international','domestic') or match_value is not null
  )
);

create index if not exists fmr_active_idx on public.flight_markup_rules (is_active, priority desc) where is_active;

drop trigger if exists trg_fmr_touch on public.flight_markup_rules;
create trigger trg_fmr_touch before update on public.flight_markup_rules
  for each row execute function public.touch_flight_updated_at();


/* ============================================================
 * RLS
 *
 * SEARCHES AND OFFERS ARE WRITTEN SERVER-SIDE ONLY.
 *   No insert or update policy exists on either table, deliberately.
 *   Under RLS that means zero client writes are possible — the API
 *   route writes with the service-role key. A client that could
 *   insert its own offer row could name its own price.
 *
 * `to authenticated` on everything calling is_admin(), per phase113.
 * ============================================================ */
alter table public.flight_searches     enable row level security;
alter table public.flight_offers       enable row level security;
alter table public.flight_markup_rules enable row level security;

/* A signed-in person may read their own search history. */
drop policy if exists flight_searches_own_read on public.flight_searches;
create policy flight_searches_own_read on public.flight_searches
  for select to authenticated using (user_id = auth.uid());

drop policy if exists flight_searches_admin_read on public.flight_searches;
create policy flight_searches_admin_read on public.flight_searches
  for select to authenticated using (public.is_admin());

/* Offers are readable by anyone holding the id, while they are live.
   The id is a random uuid, the row contains no personal data, and a
   signed-out visitor must be able to open a result they just searched. */
drop policy if exists flight_offers_live_read on public.flight_offers;
create policy flight_offers_live_read on public.flight_offers
  for select using (expires_at > now());

drop policy if exists flight_offers_admin_read on public.flight_offers;
create policy flight_offers_admin_read on public.flight_offers
  for select to authenticated using (public.is_admin());

/* Markup rules are NOT publicly readable. What REGO adds to a fare is
   commercial information; the customer sees the total, not the formula. */
drop policy if exists fmr_admin_all on public.flight_markup_rules;
create policy fmr_admin_all on public.flight_markup_rules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.flight_offers to anon, authenticated;
grant select on public.flight_searches, public.flight_markup_rules to authenticated;


select
  (select count(*) from public.flight_searches)     as searches,
  (select count(*) from public.flight_offers)       as offers,
  (select count(*) from public.flight_markup_rules) as markup_rules,
  'Empty. No markup rules means zero markup — the customer sees the provider fare.' as note;


/* ------------------------------------------------------------------
 * ROLLBACK
 *
 * Safe while Flights is pre-launch. flight_offers cascades from
 * flight_searches, so drop in this order.
 *
 *   drop table if exists public.flight_offers;
 *   drop table if exists public.flight_searches;
 *   drop table if exists public.flight_markup_rules;
 *
 * Dropping flight_markup_rules loses pricing configuration an admin
 * entered by hand. Export it first:
 *   select * from public.flight_markup_rules;
 * ------------------------------------------------------------------ */
