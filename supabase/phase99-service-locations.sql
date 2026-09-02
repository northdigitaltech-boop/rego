/* ============================================================
 * phase99 — where a provider WORKS, as opposed to where they ARE
 *
 * ADDITIVE AND IDEMPOTENT. Safe to re-run. Nothing reads this
 * table yet, so running it changes no behaviour anywhere.
 *
 * ---------------------------------------------------------------------------
 * THE GAP THIS FILLS
 *
 * A tour company in Islamabad takes travellers to Skardu. Today it has one
 * location field, and that field means "where I am". There is nowhere to say
 * "and I serve Skardu, Hunza and Gilgit" — so a traveller filtering for
 * Skardu will never find them.
 *
 * Three tables have a `service_areas text[]`: tour_companies,
 * transport_providers, roadside_providers. It is free text, not location ids,
 * so it cannot be joined, filtered or counted, and it does not exist at all on
 * tour_guides, media_providers, expedition_companies, activities,
 * tour_packages or rental_vehicles — which is most of the categories that
 * actually work across several places.
 *
 * ---------------------------------------------------------------------------
 * WHY ONE TABLE WITH A TABLE NAME IN A COLUMN
 *
 * Rego's listings live in eighteen separate tables. Postgres has no
 * polymorphic foreign key, so the options were eighteen join tables or one
 * with `listing_table` as a column.
 *
 * Eighteen would mean eighteen policies, eighteen index pairs, and a
 * nineteenth the first time a category is added. One table costs exactly one
 * thing: the database cannot check that `listing_id` points at a row that
 * exists. So `listing_table` is constrained to a known list — a typo there
 * would silently orphan every row written under it — and deleting a listing's
 * coverage is done in application code, alongside the other cross-table
 * cleanup Rego already does.
 *
 * An orphaned row is inert rather than harmful: it joins to nothing and
 * returns nothing.
 *
 * ROLLBACK: at the bottom.
 * ============================================================ */

do $$
begin
  if to_regclass('public.locations') is null then
    raise exception 'public.locations is missing — run phase72-market-areas.sql first.';
  end if;
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'public.is_admin() is missing — run phase29-auth-profiles.sql first.';
  end if;
end $$;


create table if not exists public.service_locations (
  id uuid primary key default gen_random_uuid(),

  /* Which table the listing lives in, and its id there. Constrained below. */
  listing_table text not null,
  listing_id    uuid not null,

  /* ON DELETE RESTRICT, matching locations.parent_id: removing a location
     that providers have declared they serve should stop and make someone
     look, not quietly cut the link. */
  location_id uuid not null references public.locations(id) on delete restrict,

  /* base         — the provider's own address. One per listing in practice,
                    though nothing enforces that: a company with two offices
                    is a real thing.
     service_area — somewhere they work. The one that matters for search.
     destination  — a place a tour package visits.
     pickup /
     dropoff      — for transport, where a journey starts and ends. */
  relation_type text not null default 'service_area',

  created_at timestamptz not null default now(),
  created_by uuid,

  constraint service_locations_table_known check (listing_table in (
    'hotels','homestays','hostels',
    'tour_companies','tour_packages','tour_guides',
    'transport_providers','transport_services','rental_vehicles',
    'media_providers','media_services',
    'restaurants','activities','events','coworking_spaces',
    'roadside_providers','expedition_companies','expedition_professionals'
  )),

  constraint service_locations_relation_known check (relation_type in (
    'base','service_area','destination','pickup','dropoff'
  )),

  /* Saying the same thing twice is not extra information. Without this, a
     form submitted twice doubles every row and every count built on them. */
  constraint service_locations_unique
    unique (listing_table, listing_id, location_id, relation_type)
);


/* "Where does this listing operate?" — the provider's own dashboard. */
create index if not exists service_locations_listing_idx
  on public.service_locations (listing_table, listing_id);

/* "Who serves Skardu?" — this is the one traveller search will need, and the
   reason relation_type is in the key rather than filtered afterwards. */
create index if not exists service_locations_location_idx
  on public.service_locations (location_id, relation_type);


/* ============================================================
 * ROW LEVEL SECURITY
 *
 * Read is open. These rows say "this listing serves Skardu", which is
 * exactly what a listing page displays — there is nothing private in
 * them, and traveller search has to be able to read them without a
 * session.
 *
 * Write is NOT open, and this is the part worth getting right. Provider
 * forms insert straight from the browser with the anon key, so a policy
 * of `with check (true)` would let anyone attach any listing to any
 * location — including a competitor's listing to a place they do not
 * serve. Writes are restricted to the listing's owner, matched through
 * owner_email on the listing itself, and to admins.
 * ============================================================ */
alter table public.service_locations enable row level security;

drop policy if exists service_locations_read on public.service_locations;
create policy service_locations_read on public.service_locations
  for select using (true);

drop policy if exists service_locations_admin_write on public.service_locations;
create policy service_locations_admin_write on public.service_locations
  for all using (public.is_admin()) with check (public.is_admin());

/* Owners write their own. The listing's table is dynamic, so this cannot be a
   plain EXISTS against one table — it goes through a helper that checks the
   right one. SECURITY DEFINER because it reads listing tables the caller may
   not be able to read directly. */
create or replace function public.owns_listing(p_table text, p_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text;
  v_owner text;
begin
  /* Same allowlist as the check constraint. Repeated deliberately: this
     function is reachable by any signed-in user, and format() with an
     unchecked table name is how a query becomes an injection. */
  if p_table not in (
    'hotels','homestays','hostels',
    'tour_companies','tour_packages','tour_guides',
    'transport_providers','transport_services','rental_vehicles',
    'media_providers','media_services',
    'restaurants','activities','events','coworking_spaces',
    'roadside_providers','expedition_companies','expedition_professionals'
  ) then
    return false;
  end if;

  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email'
    into v_email;
  if v_email is null then
    return false;
  end if;

  execute format('select owner_email from public.%I where id = $1', p_table)
    into v_owner using p_id;

  return v_owner is not null and lower(v_owner) = lower(v_email);
exception
  /* A listing table without owner_email. Refusing is the safe answer; an
     admin can still write, and the alternative is an error surfacing as a
     broken form. */
  when undefined_column then return false;
end $$;

comment on function public.owns_listing is
  'True when the signed-in user''s email matches owner_email on the given '
  'listing. Used by service_locations write policies, which cannot use a '
  'plain EXISTS because the listing table is a column.';

revoke all on function public.owns_listing(text, uuid) from public;
grant execute on function public.owns_listing(text, uuid) to authenticated;

drop policy if exists service_locations_owner_write on public.service_locations;
create policy service_locations_owner_write on public.service_locations
  for all
  using (public.owns_listing(listing_table, listing_id))
  with check (public.owns_listing(listing_table, listing_id));


comment on table public.service_locations is
  'Many-to-many listing to location. Separates where a provider IS (base) '
  'from where they WORK (service_area), so an Islamabad company serving '
  'Skardu can be found under Skardu.';


/* Confirm. Empty is correct — nothing writes here yet.
   The Supabase editor shows only the last result set, so this is last. */
select
  (select count(*) from public.service_locations)                     as rows_now,
  (select count(*) from pg_indexes
    where tablename = 'service_locations')                            as indexes,
  (select count(*) from pg_policies
    where tablename = 'service_locations')                            as policies;


/* ------------------------------------------------------------------
 * ROLLBACK
 *
 * Safe while nothing has been written. Check first:
 *   select count(*) from public.service_locations;
 * ------------------------------------------------------------------ */
-- drop policy if exists service_locations_owner_write on public.service_locations;
-- drop policy if exists service_locations_admin_write on public.service_locations;
-- drop policy if exists service_locations_read on public.service_locations;
-- drop function if exists public.owns_listing(text, uuid);
-- drop table if exists public.service_locations;
