/* ============================================================
 * phase97 — let a provider see the whole chain, not one flat list
 *
 * ADDITIVE. Creates one new function. Changes nothing existing:
 * areas_open_for_listings is left exactly as it is, so anything
 * already calling it keeps working.
 *
 * ---------------------------------------------------------------------------
 * THE BUG
 *
 * The provider picker built its list like this:
 *
 *     select ... from locations          <-- runs as the SIGNED-IN USER
 *     rpc areas_open_for_listings(...)   <-- SECURITY DEFINER
 *     show the intersection
 *
 * The second call is fine. The first is the problem. The read policy on
 * locations is:
 *
 *     using (is_public is true and is_active is not false)
 *
 * and it reads the row's OWN column, deliberately — an undecided location
 * must not leak to the public site. No migration has ever set is_public on
 * any location, so for anyone who is not an admin that select returns ZERO
 * rows, and the intersection is empty.
 *
 * Which means the area picker has been invisible to every actual provider.
 * It appeared to work when tested by an admin, because locations_admin_read
 * returns the whole tree to them. That is the worst shape a bug can have:
 * correct for the person checking it.
 *
 * ---------------------------------------------------------------------------
 * WHY A NEW FUNCTION AND NOT A POLICY CHANGE
 *
 * The tempting fix is to loosen the RLS policy. That would be wrong. The
 * policy guards what a TRAVELLER can load, and "explicit only, no
 * inheritance" is the right rule for a public boundary — see the comment on
 * it in phase72.
 *
 * A provider filling in a form needs something different: the areas they may
 * list in, which is already computed by resolve_location_flag. That
 * calculation is what areas_open_for_listings does; it simply did not return
 * enough columns to build a cascade. So this adds a function that returns the
 * same rows with parent_id, location_type and depth alongside.
 *
 * It exposes nothing new. Every row it returns is already returned by
 * areas_open_for_listings; the extra columns are structural, not private.
 *
 * ROLLBACK: at the bottom.
 * ============================================================ */

do $$
begin
  if to_regprocedure('public.resolve_location_flag(uuid, text, text)') is null then
    raise exception 'public.resolve_location_flag is missing — run phase72-market-areas.sql first.';
  end if;
end $$;

create or replace function public.areas_open_for_listings_tree(
  p_service text default null
)
returns table (
  id            uuid,
  name          text,
  path          text,
  parent_id     uuid,
  location_type text,
  depth         int
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    l.id,
    l.name,
    array_to_string(l.path_slugs, ' / '),
    l.parent_id,
    l.location_type,
    l.depth
  from public.locations l
  where public.resolve_location_flag(l.id, 'is_active')
    and public.resolve_location_flag(l.id, 'is_public')
    and public.resolve_location_flag(l.id, 'listings_enabled', p_service)
  order by l.depth, l.display_order, l.name;
$$;

comment on function public.areas_open_for_listings_tree is
  'Areas open to new listings for a service, with the parent links needed to '
  'build cascading dropdowns. Same rows and same rule as '
  'areas_open_for_listings; only the shape differs.';

revoke all on function public.areas_open_for_listings_tree(text) from public;
grant execute on function public.areas_open_for_listings_tree(text)
  to authenticated, anon;


/* What a provider registering a travel company would now be offered.
   If this is empty, nothing has switched "New listings" on yet — that is a
   setting, not a fault. See check-why-picker-is-flat.sql.
   The Supabase editor shows only the last result set, so this is last. */
select
  repeat('    ', depth) || name as location,
  location_type,
  depth
from public.areas_open_for_listings_tree('travel-companies');


/* ------------------------------------------------------------------
 * ROLLBACK. Drops only the new function; the original is untouched.
 * ------------------------------------------------------------------ */
-- drop function if exists public.areas_open_for_listings_tree(text);
