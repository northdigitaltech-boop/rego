/* ============================================================
 * phase116 — Flights reference data: airports & airlines
 *
 * Phase 1 of the Flights module. Reference data ONLY: no orders,
 * no payments, no passenger records. Those arrive in later phases,
 * once the questions in docs/FLIGHTS_ARCHITECTURE.md §14 are
 * settled — in particular whether REGO becomes the merchant of
 * record.
 *
 * NOTHING EXISTING IS TOUCHED. Two new tables, no alterations, no
 * changes to any policy on any current table. With FLIGHTS_ENABLED
 * unset, running this changes nothing a visitor or a provider can
 * see; it only gives autocomplete something to read.
 *
 * READ IS PUBLIC, WRITE IS ADMIN
 *   Airport and airline data is not secret — it is on every
 *   boarding pass in the world, and the search box has to read it
 *   before anyone signs in. Writes are admin-only, because a bad
 *   IATA code silently breaks every search through that airport.
 *
 * `to authenticated` ON THE WRITE POLICIES, DELIBERATELY
 *   is_admin() is SECURITY DEFINER. A policy with no TO clause is
 *   evaluated for anon too, and if the function is ever revoked
 *   from anon it will raise rather than return false, failing the
 *   whole SELECT. phase113 had to repair ~48 tables for exactly
 *   that. Not repeating it.
 *
 * ROLLBACK: at the bottom.
 * ============================================================ */

do $$
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'public.is_admin() is missing — run phase29-auth-profiles.sql first.';
  end if;
end $$;

/* Trigram matching for "isla" → Islamabad. Supabase ships it; created here
   so a fresh database does not depend on that. */
create extension if not exists pg_trgm;


/* ============================================================
 * AIRPORTS
 * ============================================================ */
create table if not exists public.airports (
  id           uuid primary key default gen_random_uuid(),

  /* The code a traveller actually types. Unique and uppercase — a duplicate
     IATA code would make autocomplete ambiguous and routing wrong. */
  iata_code    text not null unique,
  icao_code    text unique,

  airport_name text not null,
  city         text not null,
  country      text not null,
  country_code text not null,

  /* Needed to render a local departure time. A flight time without a zone is
     unreadable, and guessing from the country is wrong for large ones. */
  timezone     text,

  latitude     numeric(9,6),
  longitude    numeric(9,6),

  /* Lets an airport be retired without deleting it — historical bookings
     still have to render its name years later. */
  is_active    boolean not null default true,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint airports_iata_format check (iata_code ~ '^[A-Z]{3}$'),
  constraint airports_icao_format check (icao_code is null or icao_code ~ '^[A-Z]{4}$'),
  constraint airports_country_format check (country_code ~ '^[A-Z]{2}$'),
  constraint airports_lat_range check (latitude is null or (latitude between -90 and 90)),
  constraint airports_lon_range check (longitude is null or (longitude between -180 and 180))
);

/* Autocomplete has to answer while somebody is still typing, so the three
   things they might type are all indexed. */
create index if not exists airports_iata_idx on public.airports (iata_code);
create index if not exists airports_city_trgm on public.airports using gin (city gin_trgm_ops);
create index if not exists airports_name_trgm on public.airports using gin (airport_name gin_trgm_ops);
create index if not exists airports_active_idx on public.airports (is_active) where is_active;


/* ============================================================
 * AIRLINES
 * ============================================================ */
create table if not exists public.airlines (
  id           uuid primary key default gen_random_uuid(),
  iata_code    text not null unique,
  icao_code    text unique,
  name         text not null,
  logo_url     text,
  country_code text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  /* Two characters, and digits are legal — "9W", "4U" are real carriers. */
  constraint airlines_iata_format check (iata_code ~ '^[A-Z0-9]{2}$'),
  constraint airlines_icao_format check (icao_code is null or icao_code ~ '^[A-Z]{3}$')
);

create index if not exists airlines_iata_idx on public.airlines (iata_code);


/* ============================================================
 * updated_at
 * ============================================================ */
/* Prefixed, like every other touch function in this schema
   (touch_staff_seen, touch_expedition_updated_at, touch_sub_updated_at).
   A bare public.touch_updated_at() would be the single most likely name for
   a future migration — or a Supabase template — to define and silently
   replace, and a replaced trigger function fails quietly. */
create or replace function public.touch_flight_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end $fn$;

drop trigger if exists trg_airports_touch on public.airports;
create trigger trg_airports_touch before update on public.airports
  for each row execute function public.touch_flight_updated_at();

drop trigger if exists trg_airlines_touch on public.airlines;
create trigger trg_airlines_touch before update on public.airlines
  for each row execute function public.touch_flight_updated_at();


/* ============================================================
 * RLS
 * ============================================================ */
alter table public.airports enable row level security;
alter table public.airlines enable row level security;

/* Public read. Only active rows: a retired airport should stop being
   offered in the search box immediately, while existing bookings keep
   rendering because they store their own airport names. */
drop policy if exists airports_public_read on public.airports;
create policy airports_public_read on public.airports
  for select using (is_active is true);

drop policy if exists airlines_public_read on public.airlines;
create policy airlines_public_read on public.airlines
  for select using (is_active is true);

/* Admins see everything, including retired rows. */
drop policy if exists airports_admin_read on public.airports;
create policy airports_admin_read on public.airports
  for select to authenticated using (public.is_admin());

drop policy if exists airlines_admin_read on public.airlines;
create policy airlines_admin_read on public.airlines
  for select to authenticated using (public.is_admin());

drop policy if exists airports_admin_write on public.airports;
create policy airports_admin_write on public.airports
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists airlines_admin_write on public.airlines;
create policy airlines_admin_write on public.airlines
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.airports, public.airlines to anon, authenticated;


/* ============================================================
 * SEED
 *
 * Pakistan in full, plus the hubs Pakistani routes actually connect
 * through. This is REAL reference data — IATA codes, names and
 * coordinates are facts, not the invented fares in the mock
 * provider.
 *
 * A worldwide airport set (~9,000 rows) is a data-loading job, not
 * a migration. This seeds what the launch routes need; the admin
 * airports screen and a bulk import handle the rest.
 * ============================================================ */
insert into public.airports
  (iata_code, icao_code, airport_name, city, country, country_code, timezone, latitude, longitude)
values
  /* ---- Pakistan ---- */
  ('ISB','OPIS','Islamabad International Airport','Islamabad','Pakistan','PK','Asia/Karachi',33.549167,72.825556),
  ('KHI','OPKC','Jinnah International Airport','Karachi','Pakistan','PK','Asia/Karachi',24.906547,67.160797),
  ('LHE','OPLA','Allama Iqbal International Airport','Lahore','Pakistan','PK','Asia/Karachi',31.521564,74.403594),
  ('PEW','OPPS','Bacha Khan International Airport','Peshawar','Pakistan','PK','Asia/Karachi',33.993911,71.514581),
  ('UET','OPQT','Quetta International Airport','Quetta','Pakistan','PK','Asia/Karachi',30.251367,66.937771),
  ('MUX','OPMT','Multan International Airport','Multan','Pakistan','PK','Asia/Karachi',30.203222,71.419111),
  ('SKT','OPST','Sialkot International Airport','Sialkot','Pakistan','PK','Asia/Karachi',32.535556,74.363889),
  ('FSD','OPFA','Faisalabad International Airport','Faisalabad','Pakistan','PK','Asia/Karachi',31.365000,72.994833),
  ('KDU','OPSD','Skardu International Airport','Skardu','Pakistan','PK','Asia/Karachi',35.335500,75.536000),
  ('GIL','OPGT','Gilgit Airport','Gilgit','Pakistan','PK','Asia/Karachi',35.918806,74.333644),
  ('CJL','OPCH','Chitral Airport','Chitral','Pakistan','PK','Asia/Karachi',35.886594,71.800572),
  ('GWD','OPGD','Gwadar International Airport','Gwadar','Pakistan','PK','Asia/Karachi',25.233273,62.329494),
  ('LYP','OPBW','Bahawalpur Airport','Bahawalpur','Pakistan','PK','Asia/Karachi',29.348111,71.717975),
  ('DSK','OPDI','Dera Ismail Khan Airport','Dera Ismail Khan','Pakistan','PK','Asia/Karachi',31.909444,70.896667),

  /* ---- Gulf ---- */
  ('DXB','OMDB','Dubai International Airport','Dubai','United Arab Emirates','AE','Asia/Dubai',25.252778,55.364444),
  ('AUH','OMAA','Zayed International Airport','Abu Dhabi','United Arab Emirates','AE','Asia/Dubai',24.432972,54.651138),
  ('SHJ','OMSJ','Sharjah International Airport','Sharjah','United Arab Emirates','AE','Asia/Dubai',25.328575,55.517175),
  ('DOH','OTHH','Hamad International Airport','Doha','Qatar','QA','Asia/Qatar',25.273056,51.608056),
  ('MCT','OOMS','Muscat International Airport','Muscat','Oman','OM','Asia/Muscat',23.593278,58.284444),
  ('BAH','OBBI','Bahrain International Airport','Manama','Bahrain','BH','Asia/Bahrain',26.270834,50.633611),
  ('KWI','OKKK','Kuwait International Airport','Kuwait City','Kuwait','KW','Asia/Kuwait',29.226567,47.968928),
  ('JED','OEJN','King Abdulaziz International Airport','Jeddah','Saudi Arabia','SA','Asia/Riyadh',21.679564,39.156536),
  ('RUH','OERK','King Khalid International Airport','Riyadh','Saudi Arabia','SA','Asia/Riyadh',24.957637,46.698776),
  ('MED','OEMA','Prince Mohammad bin Abdulaziz Airport','Medina','Saudi Arabia','SA','Asia/Riyadh',24.553422,39.705061),

  /* ---- Asia ---- */
  ('KUL','WMKK','Kuala Lumpur International Airport','Kuala Lumpur','Malaysia','MY','Asia/Kuala_Lumpur',2.745578,101.709917),
  ('SIN','WSSS','Singapore Changi Airport','Singapore','Singapore','SG','Asia/Singapore',1.350189,103.994433),
  ('BKK','VTBS','Suvarnabhumi Airport','Bangkok','Thailand','TH','Asia/Bangkok',13.681108,100.747283),
  ('HKG','VHHH','Hong Kong International Airport','Hong Kong','Hong Kong','HK','Asia/Hong_Kong',22.308919,113.914603),
  ('PEK','ZBAA','Beijing Capital International Airport','Beijing','China','CN','Asia/Shanghai',40.080111,116.584556),
  ('URC','ZWWW','Ürümqi Diwopu International Airport','Ürümqi','China','CN','Asia/Shanghai',43.907100,87.474200),
  ('DEL','VIDP','Indira Gandhi International Airport','New Delhi','India','IN','Asia/Kolkata',28.556555,77.100281),
  ('KTM','VNKT','Tribhuvan International Airport','Kathmandu','Nepal','NP','Asia/Kathmandu',27.696583,85.359167),
  ('CMB','VCBI','Bandaranaike International Airport','Colombo','Sri Lanka','LK','Asia/Colombo',7.180756,79.884117),
  ('DAC','VGHS','Hazrat Shahjalal International Airport','Dhaka','Bangladesh','BD','Asia/Dhaka',23.843333,90.397781),
  ('KBL','OAKB','Hamid Karzai International Airport','Kabul','Afghanistan','AF','Asia/Kabul',34.565853,69.212328),
  ('THR','OIII','Mehrabad International Airport','Tehran','Iran','IR','Asia/Tehran',35.689167,51.313333),

  /* ---- Europe & beyond ---- */
  ('IST','LTFM','Istanbul Airport','Istanbul','Türkiye','TR','Europe/Istanbul',41.275278,28.751944),
  ('LHR','EGLL','London Heathrow Airport','London','United Kingdom','GB','Europe/London',51.470020,-0.454295),
  ('MAN','EGCC','Manchester Airport','Manchester','United Kingdom','GB','Europe/London',53.365040,-2.272430),
  ('BHX','EGBB','Birmingham Airport','Birmingham','United Kingdom','GB','Europe/London',52.453856,-1.748028),
  ('CDG','LFPG','Charles de Gaulle Airport','Paris','France','FR','Europe/Paris',49.009724,2.547778),
  ('FRA','EDDF','Frankfurt Airport','Frankfurt','Germany','DE','Europe/Berlin',50.037933,8.562152),
  ('AMS','EHAM','Amsterdam Airport Schiphol','Amsterdam','Netherlands','NL','Europe/Amsterdam',52.308613,4.763889),
  ('MXP','LIMC','Milan Malpensa Airport','Milan','Italy','IT','Europe/Rome',45.630606,8.728111),
  ('BCN','LEBL','Josep Tarradellas Barcelona-El Prat','Barcelona','Spain','ES','Europe/Madrid',41.297078,2.078464),
  ('JFK','KJFK','John F. Kennedy International Airport','New York','United States','US','America/New_York',40.641311,-73.778139),
  ('YYZ','CYYZ','Toronto Pearson International Airport','Toronto','Canada','CA','America/Toronto',43.677718,-79.624820),
  ('SYD','YSSY','Sydney Kingsford Smith Airport','Sydney','Australia','AU','Australia/Sydney',-33.946111,151.177222)
on conflict (iata_code) do nothing;


insert into public.airlines (iata_code, icao_code, name, country_code) values
  ('PK','PIA','Pakistan International Airlines','PK'),
  ('ER','SEP','Serene Air','PK'),
  ('PA','ABQ','Airblue','PK'),
  ('FL','FCL','Fly Jinnah','PK'),
  ('EK','UAE','Emirates','AE'),
  ('FZ','FDB','flydubai','AE'),
  ('EY','ETD','Etihad Airways','AE'),
  ('G9','ABY','Air Arabia','AE'),
  ('QR','QTR','Qatar Airways','QA'),
  ('WY','OMA','Oman Air','OM'),
  ('GF','GFA','Gulf Air','BH'),
  ('SV','SVA','Saudia','SA'),
  ('XY','KNE','flynas','SA'),
  ('KU','KAC','Kuwait Airways','KW'),
  ('TK','THY','Turkish Airlines','TR'),
  ('MH','MAS','Malaysia Airlines','MY'),
  ('SQ','SIA','Singapore Airlines','SG'),
  ('TG','THA','Thai Airways International','TH'),
  ('CX','CPA','Cathay Pacific','HK'),
  ('CZ','CSN','China Southern Airlines','CN'),
  ('BA','BAW','British Airways','GB'),
  ('VS','VIR','Virgin Atlantic','GB'),
  ('AF','AFR','Air France','FR'),
  ('LH','DLH','Lufthansa','DE'),
  ('KL','KLM','KLM Royal Dutch Airlines','NL')
on conflict (iata_code) do nothing;


select
  (select count(*) from public.airports) as airports,
  (select count(*) from public.airlines) as airlines,
  'Reference data only. No orders, no payments, nothing existing changed.' as note;


/* ------------------------------------------------------------------
 * ROLLBACK
 *
 * Safe while Flights is still Phase 1 — nothing references these tables
 * yet. Once flight_orders exists and stores airport codes, check for
 * dependants before dropping.
 *
 *   drop trigger if exists trg_airports_touch on public.airports;
 *   drop trigger if exists trg_airlines_touch on public.airlines;
 *   drop table if exists public.airports;
 *   drop table if exists public.airlines;
 *
 * public.touch_flight_updated_at() is intentionally NOT dropped — phase117
 * uses it, and it is harmless on its own.
 * ------------------------------------------------------------------ */
