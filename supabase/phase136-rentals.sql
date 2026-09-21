-- ============================================================
-- phase136 — Rentals as a discovery layer over existing listings.
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS A VIEW AND NOT A COLUMN ON EVERY TABLE
--
-- Rego has no single `listings` table. It has sixteen independent
-- listing tables, and a Listing is assembled in TypeScript at request
-- time. So "add is_rental to listings" has no target: doing it
-- literally would put a rental flag, a security deposit and a rental
-- period on restaurants and tour guides.
--
-- Three of the eight rental types need no new column at all, because
-- the tables already say it:
--
--   rental_vehicles   — a full rental model already: deposit, mileage,
--                       documents, hourly/daily/weekly/monthly, and a
--                       vehicle_type of Car, Jeep, Bike or Van.
--   coworking_spaces  — renting workspace by the hour, day or month IS
--                       what the table does. hot_desk_price,
--                       private_office_price, day_pass_available.
--   homestays         — whole-property fields, min_stay, max_stay, unit.
--
-- What they lack is a single place to be asked "show me everything for
-- hire". That is what public.rentals gives them. It copies nothing:
-- every listing keeps exactly one row, in one table, with one id and
-- one detail URL. Adding a ninth rental type later is one more UNION
-- branch and a constant in src/lib/rentals.ts.
--
-- SECURITY
--   security_invoker = true. The view runs with the CALLER's
--   permissions, so every row is still filtered by the RLS policy on
--   its own table. A view without this runs as its owner and would
--   hand anonymous visitors rows their policies refuse — a read
--   bypass wearing a convenience wrapper.
--
-- WHAT THIS MIGRATION DOES NOT DO
--   It does not guess. transports and transport_services carry
--   driver_included, and a driven service with driver_included = false
--   is ambiguous — it may be self-drive, or it may be a service whose
--   driver is simply not bundled in the price. Nothing is backfilled
--   from ambiguous values; providers declare it instead.
-- ---------------------------------------------------------------------------


-- ============================================================
-- 1. RENTAL ITEMS — a home for hire-able things that have none
--
-- Camera bodies, lenses, drones, tents, sleeping bags. Today a
-- provider cannot list these at all: media_services holds priced
-- SHOOTS (title, deliverables, edited_photos) and activities holds
-- EXPERIENCES (duration, difficulty, group_size). Neither has a
-- deposit, a rental period or a quantity.
--
-- Modelled on rental_vehicles deliberately — same status/active
-- pair, same owner_email, same shape of pricing — so it inherits the
-- approval queue, the admin screens and the RLS pattern without any
-- of them learning a new concept.
-- ============================================================
create table if not exists public.rental_items (
  id            uuid primary key default gen_random_uuid(),

  -- Who owns it. Matches every other listing table, and is what the
  -- RLS policies below compare against auth.email().
  owner_email   text,
  provider_name text,

  title         text not null,
  /* car | bike | jeep_4x4 | camera | photography_equipment |
     camping_equipment | house | coworking_space | other.
     Vehicles, houses and workspaces come from their own tables, so in
     practice this column holds the equipment types — but the check
     allows the full set so a type can move here later without a
     migration. */
  rental_type   text not null default 'other',

  brand         text,
  model         text,
  description   text,
  -- Everything that comes in the box: lenses, spare battery, tripod.
  includes      text[] default '{}',
  -- Tents and kit are per-person; a camera is not. Null when it makes
  -- no sense rather than a misleading 1.
  capacity      int,
  -- How many of this exact item the provider holds. Null = not tracked.
  quantity      int,

  price_per_hour  numeric,
  price_per_day   numeric not null,
  weekly_price    numeric,
  monthly_price   numeric,
  security_deposit numeric,
  /* hourly | daily | weekly | monthly | per_trip | custom — the unit
     shown on the card. Priced columns above stay authoritative. */
  pricing_unit    text not null default 'daily',

  min_days      int,
  max_days      int,
  required_documents text[] default '{}',
  damage_policy text,
  terms         text,

  delivery_available boolean not null default false,
  pickup_location    text,
  return_location    text,
  location      text,
  city          text,

  image         text,
  images        text[] default '{}',

  rating        numeric not null default 0,
  reviews       int not null default 0,
  verified      boolean not null default false,
  featured      boolean not null default false,

  -- Same pair every listing table uses, so the existing approval queue
  -- and the admin hide/delete actions work unchanged.
  status        text not null default 'pending',
  active        boolean not null default true,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint rental_items_title_not_blank check (btrim(title) <> ''),
  constraint rental_items_status_valid check (status in ('pending','approved','rejected')),
  constraint rental_items_price_positive check (price_per_day >= 0),
  constraint rental_items_type_valid check (rental_type in (
    'car','bike','jeep_4x4','camera','photography_equipment',
    'camping_equipment','house','coworking_space','other'
  )),
  constraint rental_items_pricing_unit_valid check (pricing_unit in (
    'hourly','daily','weekly','monthly','per_trip','custom'
  ))
);

create index if not exists rental_items_status_idx on public.rental_items (status, active);
create index if not exists rental_items_type_idx   on public.rental_items (rental_type);
create index if not exists rental_items_owner_idx  on public.rental_items (owner_email);
create index if not exists rental_items_city_idx   on public.rental_items (city);


-- ------------------------------------------------------------
-- RLS — the same rule phase30b applied to every listing table.
--
-- Read: approved and active rows are public; an owner sees their own
-- at any status; an admin sees everything.
-- Write: the owner of the row, or an admin. Never anonymous.
--
-- The status column is NOT writable to 'approved' by the owner — that
-- is enforced by phase111's listing status guard, which applies to
-- this table the moment it exists, for the same reason it applies to
-- the others.
-- ------------------------------------------------------------
alter table public.rental_items enable row level security;

drop policy if exists rental_items_read  on public.rental_items;
drop policy if exists rental_items_write on public.rental_items;

create policy rental_items_read on public.rental_items
  for select
  using (
    (status = 'approved' and active)
    or owner_email = auth.email()
    or public.is_admin()
  );

create policy rental_items_write on public.rental_items
  for all
  to authenticated
  using (owner_email = auth.email() or public.is_admin())
  with check (owner_email = auth.email() or public.is_admin());

comment on table public.rental_items is
  'Hire-able items with no other home — cameras, photography equipment, camping kit. Vehicles live in rental_vehicles, workspaces in coworking_spaces, houses in homestays.';


-- ============================================================
-- 2. HOUSE RENTAL — an opt-in flag, not a guess
--
-- A homestay is a room in someone's home; a holiday let is the whole
-- property. The table cannot currently tell them apart, and inferring
-- it from total_rooms or the free-text category would silently
-- reclassify real listings.
--
-- NULL means the owner has not said. Only an explicit true appears
-- under House Rental, so nothing existing changes meaning today.
-- ============================================================
alter table if exists public.homestays
  add column if not exists is_entire_place boolean;

comment on column public.homestays.is_entire_place is
  'True when the whole property is let. NULL = not declared; such rows are deliberately excluded from Rentals rather than guessed.';

create index if not exists homestays_entire_place_idx
  on public.homestays (is_entire_place)
  where is_entire_place;


-- ============================================================
-- 3. THE VIEW
--
-- One row per rentable listing, never a copy. source_table and
-- source_id are what the app uses to build the detail URL — the SAME
-- url the listing has in its own category.
-- ============================================================
drop view if exists public.rentals;

create view public.rentals
with (security_invoker = true)
as
  /* ---- Vehicles: car, bike, jeep ------------------------------
     vehicle_type is free text with a documented set of Car, Jeep,
     Bike and Van. A van is a car-class hire for a traveller choosing
     between them, so it maps to car rather than to other, where
     nobody would look for it. Anything unrecognised becomes other
     instead of vanishing. */
  select
    'rental_vehicles'::text                       as source_table,
    rv.id                                         as source_id,
    case lower(coalesce(rv.vehicle_type, ''))
      when 'car'  then 'car'
      when 'van'  then 'car'
      when 'bike' then 'bike'
      when 'jeep' then 'jeep_4x4'
      else 'other'
    end::text                                     as rental_type,
    rv.title                                      as title,
    rv.provider_name                              as provider_name,
    rv.owner_email                                as owner_email,
    rv.price_per_day                              as price,
    'day'::text                                   as price_unit,
    coalesce(rv.location, rv.pickup_location)     as location,
    rv.image                                      as image,
    rv.rating                                     as rating,
    rv.reviews                                    as reviews,
    false                                         as verified,
    rv.featured                                   as featured,
    -- Self Drive | With Driver Optional | Private Rental
    rv.rental_type                                as rental_option,
    rv.security_deposit                           as security_deposit,
    rv.created_at                                 as created_at
  from public.rental_vehicles rv
  where rv.status = 'approved' and rv.active

  union all

  /* ---- Co-working: renting space is the whole point of the table.
     No flag needed and none added — the cheapest real price becomes
     the headline, so a space that only sells private offices is not
     shown as free. */
  select
    'coworking_spaces'::text,
    cw.id,
    'coworking_space'::text,
    cw.name,
    cw.owner_name,
    cw.owner_email,
    least(
      coalesce(nullif(cw.hot_desk_price, 0), 'infinity'::numeric),
      coalesce(nullif(cw.dedicated_desk_price, 0), 'infinity'::numeric),
      coalesce(nullif(cw.private_office_price, 0), 'infinity'::numeric),
      coalesce(nullif(cw.meeting_room_price, 0), 'infinity'::numeric)
    ),
    'day'::text,
    coalesce(cw.location, cw.city),
    cw.cover_image,
    cw.rating,
    cw.reviews,
    cw.verified,
    cw.featured,
    null::text,
    null::numeric,
    cw.created_at
  from public.coworking_spaces cw
  where cw.status = 'approved'

  union all

  /* ---- Houses: explicit opt-in only, per section 2. */
  select
    'homestays'::text,
    h.id,
    'house'::text,
    h.title,
    null::text,
    h.owner_email,
    h.price,
    coalesce(h.unit, 'night'),
    h.location,
    h.image,
    h.rating,
    h.reviews,
    h.verified,
    h.featured,
    null::text,
    null::numeric,
    h.created_at
  from public.homestays h
  where h.status = 'approved' and h.is_entire_place is true

  union all

  /* ---- Equipment and anything else declared as a rental item. */
  select
    'rental_items'::text,
    ri.id,
    ri.rental_type,
    ri.title,
    ri.provider_name,
    ri.owner_email,
    ri.price_per_day,
    case ri.pricing_unit
      when 'hourly'  then 'hour'
      when 'weekly'  then 'week'
      when 'monthly' then 'month'
      when 'per_trip' then 'trip'
      else 'day'
    end,
    coalesce(ri.location, ri.city, ri.pickup_location),
    ri.image,
    ri.rating,
    ri.reviews,
    ri.verified,
    ri.featured,
    null::text,
    ri.security_deposit,
    ri.created_at
  from public.rental_items ri
  where ri.status = 'approved' and ri.active;

comment on view public.rentals is
  'Every approved rentable listing, one row each, read straight from its own table. security_invoker: each row is still gated by the RLS policy of its source. Nothing here is a copy — source_table + source_id address the original.';

grant select on public.rentals to anon, authenticated;


-- ============================================================
-- 4. INDEXES the view relies on
--
-- Only the ones its WHERE clauses actually use. rental_vehicles and
-- coworking_spaces already have status indexes from phase18 and the
-- coworking migration; these fill the gaps rather than duplicate them.
-- ============================================================
create index if not exists rental_vehicles_status_active_idx
  on public.rental_vehicles (status, active);

create index if not exists homestays_status_idx
  on public.homestays (status);


-- ============================================================
-- 5. VERIFY
-- ============================================================
do $$
declare
  n_total int;
  n_types int;
begin
  select count(*), count(distinct rental_type) into n_total, n_types
    from public.rentals;
  raise notice 'rentals view: % listing(s) across % type(s)', n_total, n_types;

  if not exists (
    select 1 from pg_views where schemaname = 'public' and viewname = 'rentals'
  ) then
    raise exception 'the rentals view was not created';
  end if;
end $$;

-- What each type currently holds. An empty type is not a fault — it
-- means nothing has been listed under it yet.
select rental_type, count(*) as listings
from public.rentals
group by rental_type
order by listings desc, rental_type;


-- ============================================================
-- BACKFILL — deliberately none.
--
-- rental_vehicles rows become rentals automatically: they already
-- are rentals and the view reads them live. coworking_spaces the
-- same. Nothing needs rewriting for those.
--
-- Homestays are NOT backfilled. Deciding from total_rooms whether a
-- property is let whole would silently reclassify listings their
-- owners wrote, and would be wrong for any multi-room house. Owners
-- tick the box; until they do, their listing behaves exactly as it
-- does today.
--
-- To see which homestays an owner might want to tick:
--
--   select id, title, total_rooms, location
--     from public.homestays
--    where status = 'approved' and is_entire_place is null
--    order by created_at desc;
-- ============================================================


-- ============================================================
-- ROLLBACK
--
-- Drops the discovery layer and leaves every existing listing
-- untouched, because none of them were ever modified.
--
--   drop view if exists public.rentals;
--   drop index if exists public.homestays_entire_place_idx;
--   alter table if exists public.homestays drop column if exists is_entire_place;
--   drop table if exists public.rental_items;   -- destroys equipment listings
--
-- Drop the table LAST and only if no equipment has been listed:
--   select count(*) from public.rental_items;
-- ============================================================
