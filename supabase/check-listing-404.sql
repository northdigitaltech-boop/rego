-- ============================================================
-- A /listings/<id> link 404s. Which table is that id in, and can
-- a signed-out visitor read it?
--
-- Read-only. Paste the id from the URL into :listing_id below.
--
-- ---------------------------------------------------------------------------
-- WHY THIS AND NOT A CODE FIX
--
-- /listings/[id] resolves an id by trying each table in turn:
--
--   hotels → homestays → hostels → tour_companies → tour_packages
--   → transports → tour_guides → transport_services → rental_vehicles
--   → media_providers → restaurants
--
-- It calls notFound() only when every one of those returns nothing.
-- The transports branch is present and correct, so a 404 on a vehicle
-- means the LOOKUP came back empty — not that the route is missing.
--
-- Two things make a lookup come back empty, and they need opposite
-- fixes:
--
--   1. The id is not in the table you think it is. Then the card is
--      linking to the wrong id and the fix is in the component.
--   2. The row is there, but RLS will not return it to `anon`. Then
--      the fix is the policy, and the giveaway is that the row shows
--      on the company page (fetched as part of a list the policy does
--      allow) but not on its own.
--
-- Query 3 tells these apart, which is the whole point of this file.
-- ---------------------------------------------------------------------------

-- Put the id from the failing URL here.
\set listing_id '90cb3562-1829-4f1f-8aa3-05d7da9c53aa'


-- ------------------------------------------------------------
-- 1. WHICH TABLE IS IT IN?
--
-- Exactly one row should come back. None means the id does not
-- exist anywhere — the card is linking to something deleted, or
-- to the wrong column.
-- ------------------------------------------------------------
do $$
declare
  t      text;
  n      int;
  target uuid := :'listing_id';
  found  boolean := false;
begin
  foreach t in array array[
    'hotels','homestays','hostels','tour_companies','tour_packages',
    'transports','tour_guides','transport_services','rental_vehicles',
    'media_providers','restaurants','activities','coworking_spaces',
    'expedition_companies','roadside_providers','rental_items'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('select count(*) from public.%I where id = $1', t)
      into n using target;
    if n > 0 then
      found := true;
      raise notice 'FOUND in public.% ', t;
    end if;
  end loop;

  if not found then
    raise notice 'id % is in NONE of the listing tables', target;
  end if;
end $$;


-- ------------------------------------------------------------
-- 2. IF IT IS A VEHICLE — is it in a state the public page accepts?
--
-- The company profile lists vehicles with status = 'approved' AND
-- active = true. The detail page does NOT filter on either, so a
-- row visible on the company page should always open. If these
-- disagree, say so — that is a real inconsistency worth knowing.
-- ------------------------------------------------------------
select
  id,
  name,
  company_id,
  company_name,
  owner_email,
  status,
  active,
  case
    when status = 'approved' and active then 'listed publicly'
    when status <> 'approved' then 'NOT approved — should not be on the company page either'
    when not active then 'inactive — should not be on the company page either'
  end as visibility
from public.transports
where id = :'listing_id';


-- ------------------------------------------------------------
-- 3. CAN A SIGNED-OUT VISITOR READ IT?
--
-- This is the decisive one. Everything above runs with your own
-- privileges, which see far more than a traveller's browser does.
-- This asks the same question as `anon`, the role the site uses
-- for a signed-out request, then puts the role back.
--
--   1 → the row is readable; the 404 is not RLS.
--   0 → RLS is what hides it. Compare the transports SELECT policy
--       with the one on transport_services, which is known to work.
-- ------------------------------------------------------------
do $$
declare n int;
begin
  set local role anon;
  select count(*) into n from public.transports where id = :'listing_id';
  reset role;
  raise notice 'anon can see % row(s) for this id', n;
end $$;

-- The policies themselves, for reading alongside that number.
select
  policyname,
  cmd,
  roles::text,
  qual as using_expression
from pg_policies
where schemaname = 'public'
  and tablename  = 'transports'
order by cmd, policyname;


-- ============================================================
-- HOW TO READ THE RESULT
--
--   Query 1 found nothing
--     → the id is stale or wrong. Check what the card links to:
--       tour-company-profile.tsx builds /listings/{id} from the
--       transports row, so the id should be transports.id.
--
--   Query 1 found it, query 3 says anon sees 1
--     → the data and the policy are both fine, and the 404 is a
--       code path. Tell me and I will look again with that ruled out.
--
--   Query 1 found it, query 3 says anon sees 0
--     → RLS. The row renders inside the company page because that
--       query is allowed, and disappears on its own because this one
--       is not. The fix is the policy, not the component.
-- ============================================================
