-- ============================================================
-- A /listings/<id> link 404s. Which table is that id in, and can
-- a signed-out visitor read it?
--
-- Read-only. Runs in the Supabase SQL editor as-is.
--
-- TO CHECK A DIFFERENT ID: find/replace the uuid below. It appears
-- four times, which is the price of not using \set — that is a psql
-- meta-command and the Supabase editor is not psql; it sends raw SQL
-- to the server, so \set comes back as a syntax error.
--
-- ---------------------------------------------------------------------------
-- WHY A QUERY AND NOT A CODE FIX
--
-- /listings/[id] resolves an id by trying each table in turn:
--
--   hotels → homestays → hostels → tour_companies → tour_packages
--   → transports → tour_guides → transport_services → rental_vehicles
--   → media_providers → restaurants
--
-- It calls notFound() only when every one returns nothing. The
-- transports branch is present, reachable and correct — so a 404 on a
-- vehicle means the LOOKUP came back empty, not that the route is
-- missing.
--
-- Two things do that, and they need opposite fixes:
--
--   1. The id is not in the table it should be. Then the card links to
--      the wrong id and the fix is in the component.
--   2. The row is there, but RLS will not return it to `anon`. The
--      giveaway is exactly what you saw: it shows on the company page,
--      because that query is a list the policy allows, and vanishes on
--      its own. Then the fix is the policy.
--
-- Query 3 tells them apart. That is the point of this file.
-- ============================================================


-- ------------------------------------------------------------
-- 1. WHICH TABLE IS IT IN?
--
-- Read the NOTICES panel, not the results grid. Exactly one table
-- should be named. None means the id does not exist anywhere.
-- ------------------------------------------------------------
do $$
declare
  t      text;
  n      int;
  target uuid := '90cb3562-1829-4f1f-8aa3-05d7da9c53aa';
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
      raise notice '>>> FOUND in public.%', t;
    end if;
  end loop;

  if not found then
    raise notice '>>> id % is in NONE of the listing tables', target;
  end if;
end $$;


-- ------------------------------------------------------------
-- 2. IF IT IS A VEHICLE — is it in a state the public page accepts?
--
-- The company profile lists vehicles with status = 'approved' AND
-- active = true. The detail page filters on NEITHER, so anything
-- visible on the company page should open. If this row is not
-- approved-and-active, the company page should not have shown it
-- either, and that inconsistency is itself the finding.
--
-- No rows here simply means it is not a transports id — see query 1.
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
    else 'inactive — should not be on the company page either'
  end as visibility
from public.transports
where id = '90cb3562-1829-4f1f-8aa3-05d7da9c53aa';


-- ------------------------------------------------------------
-- 3. CAN A SIGNED-OUT VISITOR READ IT?   ← the decisive one
--
-- Everything above runs with your own privileges, which see far more
-- than a traveller's browser. This asks the same question as `anon`,
-- the role the site uses for a signed-out request, then restores the
-- role.
--
--   1 → readable; RLS is NOT the cause. Tell me and I look again.
--   0 → RLS is what hides it, and the policy is the fix.
--
-- Again: read the NOTICES panel.
-- ------------------------------------------------------------
do $$
declare n int;
begin
  set local role anon;
  select count(*) into n
    from public.transports
   where id = '90cb3562-1829-4f1f-8aa3-05d7da9c53aa';
  reset role;
  raise notice '>>> anon can see % row(s) for this id', n;
exception when others then
  reset role;
  raise notice '>>> anon read FAILED: % (%)', sqlerrm, sqlstate;
end $$;


-- ------------------------------------------------------------
-- 4. The policies themselves, to read alongside that number.
--
-- Compare transports with transport_services: the latter is known to
-- open correctly from a listing page, so any difference between the
-- two SELECT policies is the likely culprit.
-- ------------------------------------------------------------
select
  tablename,
  policyname,
  cmd,
  roles::text as applies_to,
  qual        as using_expression
from pg_policies
where schemaname = 'public'
  and tablename in ('transports', 'transport_services')
order by tablename, cmd, policyname;


-- ============================================================
-- HOW TO READ IT
--
--   Q1 found nothing
--     → the id is stale or wrong. tour-company-profile.tsx builds
--       /listings/{id} straight from the transports row, so the id
--       should be transports.id. Send me the result and I will check
--       what that card is actually linking to.
--
--   Q1 found it, Q3 says anon sees 1
--     → data and policy are both fine and the 404 is a code path.
--       Say so and I will look again with those ruled out.
--
--   Q1 found it, Q3 says anon sees 0
--     → RLS. Query 4 shows how transports differs from the table that
--       works, and the fix goes in a migration, not a component.
-- ============================================================
