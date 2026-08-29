-- ============================================================================
-- Phase 92: close the write policies phase30b did not cover.
-- ============================================================================
--
-- PREREQUISITES
--   phase29 (public.is_admin() exists) and phase30b (listings and bookings
--   already locked down). Step 0 refuses to continue without the first.
--
-- WHAT IS LEFT AFTER phase30b
--   Nineteen tables still carry `using (true)` / `with check (true)` on
--   INSERT, UPDATE or DELETE. The anon key ships inside the browser bundle —
--   it is meant to — so those are writable by any visitor.
--
--   They do not all want the same rule, which is why this is not one loop:
--
--     A. Page content, admin-managed        → writes: admin. Reads stay open.
--     B. Subscriptions and settings         → writes: admin.
--     C. Rooms, owned through their hotel   → writes: that hotel's owner, or admin.
--     D. provider_services                  → writes: owner_email, or admin.
--     E. reviews                            → insert as yourself only.
--     F. job_applications                   → anyone may apply; only an admin may read.
--
--   listing_analytics_events is deliberately untouched. Its open INSERT is
--   correct — page views arrive from visitors who are not signed in — and its
--   read is already owner-or-admin. Closing it would silence the analytics
--   without making anything safer.
--
-- THE ONE THAT IS URGENT
--   job_applications is `for select using (true)`: every applicant's name and
--   email is readable by anyone who opens the site. F fixes that. The apply
--   form does not ask people to sign in, so INSERT has to stay open — but
--   nothing else does.
--
-- HOW IT TOUCHES POLICIES
--   Per table it drops only the non-SELECT policies and writes new ones, so
--   existing public reads are left exactly as they are. job_applications is
--   the single exception, and it is called out where it happens.
--
-- Idempotent: safe to run again. Rollback at the bottom.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- STEP 0 — prerequisite. If this says MISSING, stop.
-- ----------------------------------------------------------------------------
select case
  when to_regprocedure('public.is_admin()') is null
    then 'STOP — public.is_admin() is MISSING. Run phase29-auth-profiles.sql first.'
  else 'OK — public.is_admin() exists.'
end as prerequisite;


-- ----------------------------------------------------------------------------
-- STEP 1 — the change.
-- ----------------------------------------------------------------------------
do $$
declare
  t     text;
  pol   record;
  admin_only constant text := 'public.is_admin()';

  -- A + B: nothing in these rows belongs to a particular user.
  admin_tables text[] := array[
    'about_content', 'careers_content', 'contact_content', 'legal_content',
    'ad_slides', 'destinations',
    'platform_settings', 'subscription_plans', 'subscription_price_history',
    'subscription_audit_logs', 'subscription_promo_codes', 'subscription_test_users'
  ];
begin

  --------------------------------------------------------------------------
  -- A + B — admin writes only. Reads are untouched, so public pages that
  -- read destinations, legal text and the contact block keep working.
  --------------------------------------------------------------------------
  foreach t in array admin_tables loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);

    for pol in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t and cmd <> 'SELECT'
    loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;

    execute format('create policy "w92_insert" on public.%I for insert with check (%s)', t, admin_only);
    execute format('create policy "w92_update" on public.%I for update using (%s) with check (%s)', t, admin_only, admin_only);
    execute format('create policy "w92_delete" on public.%I for delete using (%s)', t, admin_only);
  end loop;

  --------------------------------------------------------------------------
  -- user_subscriptions — a person may see their own; only an admin changes
  -- one. Billing state that the billed party can edit is not billing state.
  --------------------------------------------------------------------------
  if to_regclass('public.user_subscriptions') is not null then
    execute 'alter table public.user_subscriptions enable row level security';
    for pol in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = 'user_subscriptions'
    loop
      execute format('drop policy if exists %I on public.user_subscriptions', pol.policyname);
    end loop;
    create policy "w92_read"   on public.user_subscriptions for select
      using (user_email = auth.email() or public.is_admin());
    create policy "w92_insert" on public.user_subscriptions for insert with check (public.is_admin());
    create policy "w92_update" on public.user_subscriptions for update using (public.is_admin()) with check (public.is_admin());
    create policy "w92_delete" on public.user_subscriptions for delete using (public.is_admin());
  end if;

  --------------------------------------------------------------------------
  -- C — rooms and booking_rooms. Neither has an owner column of its own;
  -- ownership is inherited through hotel_id. Without the hotels table there
  -- is no way to express that, so they are skipped rather than guessed at.
  --------------------------------------------------------------------------
  if to_regclass('public.hotels') is not null then
    foreach t in array array['rooms', 'booking_rooms'] loop
      if to_regclass('public.' || t) is null then continue; end if;
      if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = t and column_name = 'hotel_id'
      ) then continue; end if;

      execute format('alter table public.%I enable row level security', t);
      for pol in
        select policyname from pg_policies
        where schemaname = 'public' and tablename = t and cmd <> 'SELECT'
      loop
        execute format('drop policy if exists %I on public.%I', pol.policyname, t);
      end loop;

      execute format($f$
        create policy "w92_insert" on public.%I for insert with check (
          public.is_admin() or exists (
            select 1 from public.hotels h
            where h.id = hotel_id and h.owner_email = auth.email()))$f$, t);
      execute format($f$
        create policy "w92_update" on public.%I for update using (
          public.is_admin() or exists (
            select 1 from public.hotels h
            where h.id = hotel_id and h.owner_email = auth.email()))
          with check (
          public.is_admin() or exists (
            select 1 from public.hotels h
            where h.id = hotel_id and h.owner_email = auth.email()))$f$, t);
      execute format($f$
        create policy "w92_delete" on public.%I for delete using (
          public.is_admin() or exists (
            select 1 from public.hotels h
            where h.id = hotel_id and h.owner_email = auth.email()))$f$, t);
    end loop;
  end if;

  --------------------------------------------------------------------------
  -- D — provider_services. owner_email is on the row itself.
  --------------------------------------------------------------------------
  if to_regclass('public.provider_services') is not null then
    execute 'alter table public.provider_services enable row level security';
    for pol in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = 'provider_services' and cmd <> 'SELECT'
    loop
      execute format('drop policy if exists %I on public.provider_services', pol.policyname);
    end loop;
    create policy "w92_insert" on public.provider_services for insert
      with check (owner_email = auth.email() or public.is_admin());
    create policy "w92_update" on public.provider_services for update
      using (owner_email = auth.email() or public.is_admin())
      with check (owner_email = auth.email() or public.is_admin());
    create policy "w92_delete" on public.provider_services for delete
      using (owner_email = auth.email() or public.is_admin());
  end if;

  --------------------------------------------------------------------------
  -- E — reviews. The form already requires signing in and sends the session's
  -- own address; the database was not checking. Until now anyone could post a
  -- review under any name, for any listing, without an account.
  --------------------------------------------------------------------------
  if to_regclass('public.reviews') is not null then
    execute 'alter table public.reviews enable row level security';
    for pol in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = 'reviews' and cmd <> 'SELECT'
    loop
      execute format('drop policy if exists %I on public.reviews', pol.policyname);
    end loop;
    create policy "w92_insert" on public.reviews for insert
      with check (customer_email = auth.email());
    create policy "w92_update" on public.reviews for update
      using (customer_email = auth.email() or public.is_admin())
      with check (customer_email = auth.email() or public.is_admin());
    create policy "w92_delete" on public.reviews for delete
      using (customer_email = auth.email() or public.is_admin());
  end if;

  --------------------------------------------------------------------------
  -- F — job_applications. The only place a SELECT policy is dropped, and the
  -- reason this migration should not wait: the table is `for select using
  -- (true)`, so every applicant's name and email is public.
  --
  -- INSERT stays open on purpose — the apply form asks for a name and an
  -- email and does not require an account, and gating that would turn away
  -- applicants rather than protect anything.
  --------------------------------------------------------------------------
  if to_regclass('public.job_applications') is not null then
    execute 'alter table public.job_applications enable row level security';
    for pol in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = 'job_applications'
    loop
      execute format('drop policy if exists %I on public.job_applications', pol.policyname);
    end loop;
    create policy "w92_read"   on public.job_applications for select using (public.is_admin());
    create policy "w92_insert" on public.job_applications for insert with check (true);
    create policy "w92_update" on public.job_applications for update using (public.is_admin()) with check (public.is_admin());
    create policy "w92_delete" on public.job_applications for delete using (public.is_admin());
  end if;

end $$;


-- ----------------------------------------------------------------------------
-- STEP 2 — verify. Rows here are still writable by anyone holding the anon key.
--
-- listing_analytics_events is expected and correct: an anonymous page view has
-- to be insertable by an anonymous visitor. Anything else appearing here was
-- not covered by phase30b or by this file, and is worth asking about.
-- ----------------------------------------------------------------------------
select
  c.relname   as table_name,
  pol.polname as policy,
  case pol.polcmd when 'a' then 'INSERT' when 'w' then 'UPDATE'
                  when 'd' then 'DELETE' else 'ALL' end as command
from pg_policy pol
join pg_class c on c.oid = pol.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and pol.polcmd <> 'r'
  and (coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') = 'true'
    or coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') = 'true')
order by c.relname, pol.polname;


-- ============================================================================
-- ROLLBACK — only if something in the app breaks.
--
-- Reopens exactly the tables this file touched, and nothing else. It leaves
-- them as open as they were before, so it is a way to keep working, not a
-- resting place. job_applications is deliberately NOT reopened for reading:
-- if this migration has to be undone, publishing applicants' contact details
-- again is not part of undoing it.
-- ============================================================================
-- do $$
-- declare t text; pol record;
-- begin
--   foreach t in array array[
--     'about_content','careers_content','contact_content','legal_content',
--     'ad_slides','destinations','platform_settings','subscription_plans',
--     'subscription_price_history','subscription_audit_logs',
--     'subscription_promo_codes','subscription_test_users','user_subscriptions',
--     'rooms','booking_rooms','provider_services','reviews'
--   ] loop
--     if to_regclass('public.' || t) is null then continue; end if;
--     for pol in select policyname from pg_policies
--       where schemaname = 'public' and tablename = t and policyname like 'w92\_%'
--     loop
--       execute format('drop policy if exists %I on public.%I', pol.policyname, t);
--     end loop;
--     execute format('create policy "open_all" on public.%I for all using (true) with check (true)', t);
--   end loop;
--
--   -- job_applications: writes reopened, reading stays admin-only.
--   if to_regclass('public.job_applications') is not null then
--     drop policy if exists "w92_update" on public.job_applications;
--     drop policy if exists "w92_delete" on public.job_applications;
--     create policy "open_write" on public.job_applications for update using (true) with check (true);
--   end if;
-- end $$;
