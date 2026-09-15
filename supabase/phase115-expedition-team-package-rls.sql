/* ============================================================
 * phase115 — close the open writes on expedition team & packages
 *
 * THE HOLE
 *   phase56 created these two tables with:
 *
 *     for insert with check (true)
 *     for update using (true) with check (true)
 *     for delete using (true)
 *
 *   `true` means every signed-in account. A traveller, or a rival
 *   company, could add themselves to any expedition company's
 *   roster, rewrite a package price, or delete the roster
 *   outright. phase56's own comment says gating "happens at the
 *   application layer" — that is the hidden-buttons-only approach,
 *   and it holds only until somebody sends a request by hand.
 *
 *   The READ policies stay exactly as they are: `using (true)` is
 *   correct there. The public site lists team members in the Tour
 *   Guides grid and renders their profile page, and packages show
 *   on the company page. Nothing about this file changes what a
 *   visitor can see.
 *
 * WHO MAY WRITE AFTER THIS
 *   • the company's owner  (expedition_companies.owner_email)
 *   • an admin
 *   • staff holding manage_expeditions — phase110 already grants
 *     that on expedition_packages, so leaving it out would have
 *     quietly revoked a permission an admin had deliberately
 *     given. Team members were never in phase110's list; they are
 *     included here so the module means one thing.
 *
 * `to authenticated` ON EVERY WRITE POLICY, DELIBERATELY
 *   staff_manages() is revoked from anon. A policy without a TO
 *   clause is evaluated for anon too, and then it does not return
 *   false — it RAISES, and the whole statement fails. That is the
 *   fault phase113 had to repair across ~48 tables. Not repeating
 *   it here.
 *
 * ROLLBACK: at the bottom. Read the warning before running it.
 * ============================================================ */

do $$
begin
  if to_regclass('public.expedition_team_members') is null then
    raise exception 'public.expedition_team_members is missing — run phase56 first.';
  end if;
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'public.is_admin() is missing — run phase29-auth-profiles.sql first.';
  end if;
end $$;

/* staff_manages() arrived in phase110. Not every deployment has run it, so
   the policies below are built with or without it rather than failing. */
do $$
declare
  has_staff boolean := to_regprocedure('public.staff_manages(text)') is not null;
  staff_clause text := case
    when to_regprocedure('public.staff_manages(text)') is not null
      then $c$ or public.staff_manages('expeditions')$c$
    else ''
  end;
  owner_clause text;
  t text;
begin
  if not has_staff then
    raise notice 'phase110 not applied — building owner/admin policies only';
  end if;

  /* ---------------- team members ----------------
     No owner_email column of their own, so ownership is the company's. */
  owner_clause := format($c$(
      exists (
        select 1 from public.expedition_companies c
         where c.id = expedition_team_members.company_id
           and c.owner_email = auth.email()
      )
      or public.is_admin()%s
    )$c$, staff_clause);

  execute 'drop policy if exists expedition_team_members_insert on public.expedition_team_members';
  execute 'drop policy if exists expedition_team_members_update on public.expedition_team_members';
  execute 'drop policy if exists expedition_team_members_delete on public.expedition_team_members';

  execute format(
    'create policy expedition_team_members_insert on public.expedition_team_members
       for insert to authenticated with check %s', owner_clause);
  execute format(
    'create policy expedition_team_members_update on public.expedition_team_members
       for update to authenticated using %s with check %s', owner_clause, owner_clause);
  execute format(
    'create policy expedition_team_members_delete on public.expedition_team_members
       for delete to authenticated using %s', owner_clause);

  /* ---------------- packages ----------------
     These DO carry owner_email, but it is set by the client on insert, so it
     is not trusted on its own — the company is still the authority. Both are
     accepted so an existing row whose owner_email is right keeps working. */
  owner_clause := format($c$(
      exists (
        select 1 from public.expedition_companies c
         where c.id = expedition_packages.company_id
           and c.owner_email = auth.email()
      )
      or public.is_admin()%s
    )$c$, staff_clause);

  execute 'drop policy if exists expedition_packages_insert on public.expedition_packages';
  execute 'drop policy if exists expedition_packages_update on public.expedition_packages';
  execute 'drop policy if exists expedition_packages_delete on public.expedition_packages';

  execute format(
    'create policy expedition_packages_insert on public.expedition_packages
       for insert to authenticated with check %s', owner_clause);
  execute format(
    'create policy expedition_packages_update on public.expedition_packages
       for update to authenticated using %s with check %s', owner_clause, owner_clause);
  execute format(
    'create policy expedition_packages_delete on public.expedition_packages
       for delete to authenticated using %s', owner_clause);
end $$;


/* What this looks like afterwards. The two `_read` policies should still be
   there with qual = true — if they are not, the public pages have gone dark
   and that is the thing to fix before anything else. */
select tablename, policyname, cmd, roles, qual, with_check
  from pg_policies
 where schemaname = 'public'
   and tablename in ('expedition_team_members', 'expedition_packages')
 order by tablename, cmd, policyname;


/* ------------------------------------------------------------------
 * ROLLBACK
 *
 * This restores the open writes — any signed-in account able to edit any
 * company's roster and prices. Only worth running if a real provider is
 * locked out and you need them working while the cause is found.
 *
 *   drop policy if exists expedition_team_members_insert on public.expedition_team_members;
 *   drop policy if exists expedition_team_members_update on public.expedition_team_members;
 *   drop policy if exists expedition_team_members_delete on public.expedition_team_members;
 *   drop policy if exists expedition_packages_insert     on public.expedition_packages;
 *   drop policy if exists expedition_packages_update     on public.expedition_packages;
 *   drop policy if exists expedition_packages_delete     on public.expedition_packages;
 *
 *   create policy expedition_team_members_insert on public.expedition_team_members
 *     for insert with check (true);
 *   create policy expedition_team_members_update on public.expedition_team_members
 *     for update using (true) with check (true);
 *   create policy expedition_team_members_delete on public.expedition_team_members
 *     for delete using (true);
 *   create policy expedition_packages_insert on public.expedition_packages
 *     for insert with check (true);
 *   create policy expedition_packages_update on public.expedition_packages
 *     for update using (true) with check (true);
 *   create policy expedition_packages_delete on public.expedition_packages
 *     for delete using (true);
 * ------------------------------------------------------------------ */
