/* ============================================================
 * phase113 — two fixes, one file
 *
 *   A. Staff could not SEE the places they may manage, so "add a
 *      destination" had nothing to add into.
 *   B. The staff policies added in phase110 and phase111 are
 *      evaluated for LOGGED-OUT visitors too, and they call a
 *      function a logged-out visitor may not execute. That is a
 *      public-site fault, and it is the more expensive of the two.
 *
 * ------------------------------------------------------------
 * A. THE REPORTED BUG
 *
 *   A marketing member with add_location could not add a
 *   destination. The write was never refused — it never got a
 *   chance. /api/admin/markets writes with the service-role key
 *   and authorises with staff_can(); that part worked.
 *
 *   The screen was empty. Market & Area Management reads `markets`
 *   and `locations` with the person's own session, and phase72
 *   gave those tables two read policies: the public one, and
 *   is_admin(). The public one is
 *
 *       is_public is true and is_active is true
 *
 *   and phase72 seeds Pakistan with BOTH false on purpose, so that
 *   running the migration changes nothing a visitor sees. A staff
 *   member is not an admin, so they matched neither policy and got
 *   zero markets — which the screen renders as "No markets yet.
 *   Run phase72-market-areas.sql in Supabase."
 *
 *   Empty dropdown, empty tree, no parent to add under; and
 *   anything created would have been invisible to its creator
 *   anyway, because a new location starts with is_public NULL by
 *   design.
 *
 *   Worth keeping: when a screen "cannot do" something, check what
 *   it can SEE before checking what it may DO.
 *
 * ------------------------------------------------------------
 * B. THE FAULT FOUND WHILE TESTING A
 *
 *   A policy created without a TO clause applies to PUBLIC — every
 *   role, including `anon`, which is what a logged-out visitor
 *   uses. Permissive policies are OR'd, but Postgres still
 *   EVALUATES each one, and staff_can()/staff_manages() are
 *   revoked from anon on purpose. So for anon the policy does not
 *   return false; it raises
 *
 *       permission denied for function staff_can
 *
 *   and the whole SELECT fails. Not only for the hidden rows —
 *   `select ... where is_public is true` fails too. Proven in
 *   scripts/test-phase113.mjs, which asserts it before and after.
 *
 *   phase110 (~30 tables) and phase111 (18 listing tables) both
 *   create their policies without a TO clause. So on any of those
 *   tables the public website reads nothing at all.
 *
 *   The repair is one word per policy: TO authenticated. It cannot
 *   widen anything — it only stops a role that was never meant to
 *   be granted by these policies from having to evaluate them. The
 *   predicate is not touched, so nobody gains or loses access.
 *
 * ------------------------------------------------------------
 * WHAT THIS FILE DOES NOT DO
 *   It changes no phase72 policy, and it makes nothing public. It
 *   grants READ only: writing still goes through
 *   /api/admin/markets, which still calls staff_can(permission,
 *   location) and still refuses somebody whose scope does not
 *   cover the area. Seeing a district is not permission to edit it.
 *
 * WHY view_locations AND NOT A NEW PERMISSION
 *   view_locations already exists (phase104), is already carried by
 *   every seeded role, and is already what the portal tab is gated
 *   on. A second permission meaning the same thing is a second
 *   thing to grant and to forget to grant.
 *
 * NOT INCLUDED: market_audit_logs
 *   It stores actor_email for every change. Reading the tree does
 *   not require knowing which colleague changed what, so it stays
 *   admin-only.
 *
 * ROLLBACK: at the bottom.
 * ============================================================ */

do $$
begin
  if to_regprocedure('public.staff_can(text, uuid)') is null then
    raise exception 'public.staff_can() is missing — run phase104-staff-foundation.sql first.';
  end if;
  if to_regclass('public.markets') is null then
    raise exception 'public.markets is missing — run phase72-market-areas.sql first.';
  end if;
end $$;


/* ============================================================
 * PART A — staff can read the tree
 *
 * `to authenticated` on every one of them, for the reason in B.
 * ============================================================ */

/* ---- markets: the dropdown at the top of the screen ---- */
drop policy if exists staff113_markets_read on public.markets;
create policy staff113_markets_read on public.markets
  for select to authenticated
  using (public.staff_can('view_locations'));

/* ---- locations: the tree, including the not-yet-public rows ----
   Unscoped on purpose. A member scoped to Baltistan still needs to see
   Pakistan and Gilgit-Baltistan above it, or Baltistan has no visible
   path to it and the tree cannot be drawn. Scope is enforced where it
   changes something — on the write, in /api/admin/markets. */
drop policy if exists staff113_locations_read on public.locations;
create policy staff113_locations_read on public.locations
  for select to authenticated
  using (public.staff_can('view_locations'));

/* ---- per-service settings, shown on the Services tab ---- */
drop policy if exists staff113_lss_read on public.location_service_settings;
create policy staff113_lss_read on public.location_service_settings
  for select to authenticated
  using (public.staff_can('view_locations'));

/* ---- the SEO draft, shown on the SEO tab ----
   Read here, written through the API under edit_location. */
drop policy if exists staff113_location_seo_read on public.location_seo;
create policy staff113_location_seo_read on public.location_seo
  for select to authenticated
  using (public.staff_can('view_locations'));

/* ---- translations, so a translated name is not blank for staff ---- */
drop policy if exists staff113_location_translations_read on public.location_translations;
create policy staff113_location_translations_read on public.location_translations
  for select to authenticated
  using (public.staff_can('view_locations'));


/* Supabase already grants select on these to `authenticated`; stated so a
   fresh database does not depend on that default. RLS still decides rows. */
grant select on public.markets, public.locations,
                public.location_service_settings, public.location_seo,
                public.location_translations
  to authenticated;


/* ============================================================
 * PART B — stop anon from having to evaluate the staff policies
 *
 * ALTER POLICY ... TO authenticated changes only the role list.
 * The USING and WITH CHECK expressions are left exactly as
 * phase110 and phase111 wrote them, so this cannot change who is
 * allowed to do what — only which roles are made to ask.
 *
 * Idempotent, and safe to run whether or not those phases have
 * been applied: it loops over the policies that actually exist.
 * ============================================================ */
do $$
declare
  r record;
  n int := 0;
begin
  for r in
    select schemaname, tablename, policyname, roles
      from pg_policies
     where schemaname = 'public'
       and (policyname like 'staff110\_%' or policyname like 'staff111\_%')
  loop
    /* Only the ones still aimed at PUBLIC. Re-running changes nothing. */
    if r.roles = '{public}' then
      execute format('alter policy %I on public.%I to authenticated',
                     r.policyname, r.tablename);
      n := n + 1;
    end if;
  end loop;

  raise notice 'phase113: repaired % staff policies that anon was being made to evaluate', n;
end $$;


select
  (select count(*) from public.markets)   as markets_total,
  (select count(*) from public.locations) as locations_total,
  (select count(*) from pg_policies
    where schemaname = 'public'
      and (policyname like 'staff110\_%' or policyname like 'staff111\_%' or policyname like 'staff113\_%')
      and roles = '{public}')             as policies_still_public,
  'Staff with view_locations can now read the tree. Nothing became public.' as note;


/* ------------------------------------------------------------------
 * ROLLBACK
 *
 * Part A — removes only what this file added. Afterwards staff see the
 * public rows only, i.e. the behaviour that produced the bug. Admins and
 * the public site are unaffected either way.
 *
 *   drop policy if exists staff113_markets_read               on public.markets;
 *   drop policy if exists staff113_locations_read             on public.locations;
 *   drop policy if exists staff113_lss_read                   on public.location_service_settings;
 *   drop policy if exists staff113_location_seo_read          on public.location_seo;
 *   drop policy if exists staff113_location_translations_read on public.location_translations;
 *
 * Part B — DO NOT ROLL BACK. Putting `to public` back would restore the
 * fault, not undo a change of behaviour: logged-out visitors would again
 * be made to evaluate a function they may not execute, and every read on
 * those tables would fail. It is written out only so the operation is on
 * the record:
 *
 *   -- alter policy staff110_<table> on public.<table> to public;
 * ------------------------------------------------------------------ */
