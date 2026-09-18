-- ============================================================
-- phase131 — close eleven tables that are open to the internet.
--
-- SEC-003 (notifications, 6 tables) and SEC-004 (expeditions,
-- 5 tables). Both P0.
--
-- ---------------------------------------------------------------------------
-- WHAT IS WRONG TODAY
--
-- phase50 and phase52 both end with a loop that writes, for
-- every one of their tables:
--
--     for select using (true)
--     for insert with check (true)
--     for update using (true) with check (true)
--     for delete using (true)
--
-- RLS is enabled, which makes the tables look protected in the
-- Supabase dashboard. The policies then permit everything to
-- everyone — including `anon`, the key published in the source
-- of every page. phase50's own comment calls this "permissive,
-- app-gated", and app-gating is not gating: the REST endpoint is
-- reachable without the app.
--
-- SEC-003, notifications. One request returns every notification
-- Rego has ever sent — each row carrying a user's email address
-- and the booking it refers to. The same key can DELETE all of
-- them, or INSERT a convincing fake addressed to any customer.
-- notification_preferences and notification_delivery_logs are
-- bulk email-address exports on the same terms.
--
-- SEC-004, expeditions. Anyone may rewrite or delete any
-- expedition company or professional profile — including, as the
-- tables stand, their `verified` flag.
--
-- ---------------------------------------------------------------------------
-- THE SHAPE OF THE FIX
--
-- Public things stay publicly readable, because that is what
-- makes the site work: promotions, price history, expedition
-- listings and the reference lists are all read by signed-out
-- visitors browsing Rego. Nothing about the traveller-facing
-- site changes.
--
-- Private things become owner-scoped. Writes become owner-or-
-- admin. Reference data becomes admin-write.
--
-- NOTHING LEGITIMATE BREAKS — checked against the code first:
--   * notifications are only ever INSERTED by two server routes
--     (/api/admin/broadcast and /api/cron/signup-reminders),
--     both on the service role, which bypasses RLS entirely. The
--     browser only reads them and marks them read/deleted, both
--     scoped to the signed-in user. So insert can be closed to
--     the client without touching a working flow.
--   * price_alerts, notification_preferences: the browser writes
--     only its own rows already (src/lib/price-alerts.ts,
--     src/lib/notifications.ts).
--   * expedition company/professional edits go through
--     src/lib/expeditions.ts as the owner; the admin dashboard
--     calls the same functions and passes is_admin().
--
-- `to authenticated` on every owner-scoped policy: an anonymous
-- caller has no auth.email() and could never match, and naming
-- the role keeps anon out of any SECURITY DEFINER call inside
-- the policy — the failure mode that broke 48 tables in phase110.
-- ============================================================

-- ------------------------------------------------------------
-- SEC-003 — notifications and friends.
-- ------------------------------------------------------------
do $$
declare t text; pol record;
begin
  foreach t in array array[
    'notifications','notification_preferences','price_alerts',
    'promotions','price_history','notification_delivery_logs'
  ] loop
    if to_regclass('public.' || t) is null then
      raise notice 'skipped % (table not present)', t;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);
    for pol in select policyname from pg_policies
                where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;
  end loop;
end $$;

/* Private to one person. */
do $$
declare t text;
begin
  foreach t in array array['notifications','notification_preferences','price_alerts'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format($p$create policy "%1$s_own_read" on public.%1$I for select
      to authenticated using (user_email = auth.email() or public.is_admin())$p$, t);
    execute format($p$create policy "%1$s_own_update" on public.%1$I for update
      to authenticated using (user_email = auth.email() or public.is_admin())
      with check (user_email = auth.email() or public.is_admin())$p$, t);
    execute format($p$create policy "%1$s_own_delete" on public.%1$I for delete
      to authenticated using (user_email = auth.email() or public.is_admin())$p$, t);
  end loop;
end $$;

/* A visitor may create their own price alert and their own preferences row —
   that is the feature. They may not create a notification: those are written
   by the two server routes on the service role, which bypasses RLS. */
create policy "price_alerts_own_insert" on public.price_alerts for insert
  to authenticated with check (user_email = auth.email() or public.is_admin());
create policy "notification_preferences_own_insert" on public.notification_preferences for insert
  to authenticated with check (user_email = auth.email() or public.is_admin());
create policy "notifications_admin_insert" on public.notifications for insert
  to authenticated with check (public.is_admin());

/* Delivery logs are an audit trail: readable by its subject and by admins,
   written only by the server. */
create policy "ndl_read" on public.notification_delivery_logs for select
  to authenticated using (user_email = auth.email() or public.is_admin());

/* Promotions are marketing shown to everyone; only the owning provider or an
   admin may write one. */
create policy "promotions_public_read" on public.promotions for select using (true);
create policy "promotions_owner_insert" on public.promotions for insert
  to authenticated with check (owner_email = auth.email() or public.is_admin());
create policy "promotions_owner_update" on public.promotions for update
  to authenticated using (owner_email = auth.email() or public.is_admin())
  with check (owner_email = auth.email() or public.is_admin());
create policy "promotions_owner_delete" on public.promotions for delete
  to authenticated using (owner_email = auth.email() or public.is_admin());

/* Price history drives the public "price dropped" badge, so it stays readable.
   It has no owner column, so writes are admin-only rather than guessed at. */
create policy "price_history_public_read" on public.price_history for select using (true);
create policy "price_history_admin_write" on public.price_history for all
  to authenticated using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- SEC-004 — expeditions.
-- ------------------------------------------------------------
do $$
declare t text; pol record;
begin
  foreach t in array array[
    'expedition_companies','expedition_professionals',
    'expedition_peaks','expedition_routes','expedition_roles'
  ] loop
    if to_regclass('public.' || t) is null then
      raise notice 'skipped % (table not present)', t;
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    for pol in select policyname from pg_policies
                where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;
    -- Public browsing is the product. Reads stay open on all five.
    execute format('create policy "%1$s_public_read" on public.%1$I for select using (true)', t);
  end loop;
end $$;

/* Owner-managed profiles. */
do $$
declare t text;
begin
  foreach t in array array['expedition_companies','expedition_professionals'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format($p$create policy "%1$s_owner_insert" on public.%1$I for insert
      to authenticated with check (owner_email = auth.email() or public.is_admin())$p$, t);
    execute format($p$create policy "%1$s_owner_update" on public.%1$I for update
      to authenticated using (owner_email = auth.email() or public.is_admin())
      with check (owner_email = auth.email() or public.is_admin())$p$, t);
    execute format($p$create policy "%1$s_owner_delete" on public.%1$I for delete
      to authenticated using (owner_email = auth.email() or public.is_admin())$p$, t);
  end loop;
end $$;

/* Reference lists an admin curates. */
do $$
declare t text;
begin
  foreach t in array array['expedition_peaks','expedition_routes','expedition_roles'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format($p$create policy "%1$s_admin_write" on public.%1$I for all
      to authenticated using (public.is_admin()) with check (public.is_admin())$p$, t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- SEC-005 (P1, fixed here because the table is already open) —
-- a provider must not be able to verify themselves.
--
-- Owner-scoped UPDATE is right for a company's own description
-- and photos. It is wrong for `verified`, `featured` and
-- `status`: those are Rego's judgement about the provider, and
-- an owner who can set them can award themselves the verified
-- badge travellers rely on. RLS gates rows, not columns, so this
-- needs a trigger — the same reasoning as phase130.
-- ------------------------------------------------------------
create or replace function public.guard_expedition_trust_columns()
  returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;   -- service role, SQL editor, or a real admin
  end if;
  if new.verified is distinct from old.verified
     or new.featured is distinct from old.featured
     or new.status   is distinct from old.status then
    raise exception 'Only an administrator may change verified, featured or status'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['expedition_companies','expedition_professionals'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop trigger if exists %1$s_trust_guard on public.%1$I', t);
    execute format($p$create trigger %1$s_trust_guard before update on public.%1$I
      for each row execute function public.guard_expedition_trust_columns()$p$, t);
  end loop;
end $$;

-- ============================================================
-- STILL OPEN AFTER THIS FILE
--
-- expedition_team_members and expedition_packages (phase56) have
-- the same fully-open policies. phase115 was already written to
-- fix them and has never been run. Run it.
-- ============================================================

-- ============================================================
-- ROLLBACK
--
-- Re-opens these tables to the public internet. There is no good
-- reason to run this; if a legitimate flow breaks, fix the
-- policy for that flow instead.
--
--   -- drop the triggers
--   drop trigger if exists expedition_companies_trust_guard on public.expedition_companies;
--   drop trigger if exists expedition_professionals_trust_guard on public.expedition_professionals;
--   drop function if exists public.guard_expedition_trust_columns();
--   -- then re-run the RLS blocks at the end of phase50 and phase52.
-- ============================================================
