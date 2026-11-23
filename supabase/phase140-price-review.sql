/* ============================================================
 * phase140 — implausibly low prices go to manual review
 *
 * ADDITIVE AND IDEMPOTENT. One function, one trigger per table.
 * No row is changed by running this file. ROLLBACK at the bottom.
 *
 * ---------------------------------------------------------------------------
 * WHY
 *
 * A launch review found "Female drivers" listed at PKR 15/day — almost
 * certainly missing zeros or a per-km rate typed into a per-day box.
 * Since phase138, an approved partner's new listings and edits go live
 * immediately, so nothing stood between a typo and the public site.
 *
 * Rule (from the review): anything priced above 0 and under PKR 500 is
 * held for manual review. For anyone who is not an admin, when a row is
 * inserted — or a price on it is changed — to such a value, its status
 * is set to 'pending' and it leaves the public site until an admin
 * approves it. A price of 0 / empty is left alone (it means "on
 * request", which is not a typo).
 *
 * ORDER WITH THE OTHER TRIGGERS
 *   Postgres fires BEFORE triggers in name order. This one is named
 *   zz_price_review so it runs AFTER set_new_status (phase138, which
 *   would otherwise mark a trusted partner's insert 'approved') and
 *   AFTER guard_status (phase111, which refuses owner status changes —
 *   it has already compared old and new status by the time this runs).
 *
 * Tables: the stay, tour, transport, guide and expedition listings,
 * where a price under PKR 500 is not a real price. Activities,
 * restaurants and co-working are left out on purpose — a PKR 300 boat
 * ride or a PKR 400 day pass can be genuine.
 * ============================================================ */

create or replace function public.review_low_price()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n jsonb := to_jsonb(new);
  o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  k text;
  v numeric;
  low boolean := false;
begin
  /* Sessionless (service role) and admins are trusted to set prices. */
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if not (n ? 'status') then
    return new;
  end if;

  foreach k in array array[
    'price','price_per_day','price_per_person','price_per_trip',
    'daily_rate','starting_price'
  ] loop
    if not (n ? k) or jsonb_typeof(n->k) <> 'number' then
      continue;
    end if;
    /* On an edit, only a price that actually changed counts — re-saving a
       form that carries an old low price must not pull a live listing. */
    if tg_op = 'UPDATE' and (o->k) is not distinct from (n->k) then
      continue;
    end if;
    v := (n->>k)::numeric;
    if v > 0 and v < 500 then
      low := true;
      exit;
    end if;
  end loop;

  if low then
    new.status := 'pending';
  end if;
  return new;
end $$;

comment on function public.review_low_price is
  'Holds a listing for review (status=pending) when a non-admin sets a price '
  'above 0 and under PKR 500. Runs after set_new_status and guard_status.';


do $$
declare
  t text;
begin
  foreach t in array array[
    'hotels','homestays','hostels',
    'tour_packages','tour_guides','transports',
    'transport_services','rental_vehicles',
    'expedition_companies','expedition_professionals'
  ] loop
    if to_regclass('public.' || t) is null then
      raise notice 'skipping %, table not present', t;
      continue;
    end if;
    execute format('drop trigger if exists zz_price_review on public.%I', t);
    execute format(
      'create trigger zz_price_review before insert or update on public.%I '
      'for each row execute function public.review_low_price()', t
    );
  end loop;
end $$;


/* Listings ALREADY live with a price under PKR 500 — for an admin to check
   by hand. Nothing is changed by this query. */
select 'transport_services' as tbl, id::text, title as name, price_per_day::text as price, status
  from public.transport_services where price_per_day > 0 and price_per_day < 500
union all
select 'rental_vehicles', id::text, title, price_per_day::text, status
  from public.rental_vehicles where price_per_day > 0 and price_per_day < 500
union all
select 'tour_packages', id::text, title, price_per_person::text, status
  from public.tour_packages where price_per_person > 0 and price_per_person < 500
union all
select 'hotels', id::text, title, price::text, status
  from public.hotels where price > 0 and price < 500;


/* ------------------------------------------------------------------
 * ROLLBACK
 *
 * do $$
 * declare t text;
 * begin
 *   foreach t in array array['hotels','homestays','hostels','tour_packages',
 *     'tour_guides','transports','transport_services','rental_vehicles',
 *     'expedition_companies','expedition_professionals'] loop
 *     if to_regclass('public.' || t) is not null then
 *       execute format('drop trigger if exists zz_price_review on public.%I', t);
 *     end if;
 *   end loop;
 * end $$;
 * drop function if exists public.review_low_price();
 * ------------------------------------------------------------------ */
