/* ============================================================
 * phase111 — a provider can no longer approve their own listing
 *
 * ADDITIVE AND IDEMPOTENT. One function, one trigger per listing table,
 * three permissions. ROLLBACK at the bottom.
 *
 * ---------------------------------------------------------------------------
 * THE HOLE
 *
 * phase30 locked the listing tables like this:
 *
 *     using      (owner_email = auth.email() or public.is_admin())
 *     with check (owner_email = auth.email() or public.is_admin())
 *
 * Correct about WHICH ROWS. Silent about WHICH COLUMNS. `status` is an
 * ordinary column on a row the owner owns, so a provider holding the anon key
 * — which ships in the browser bundle, as it is meant to — can send
 *
 *     update hotels set status = 'approved' where id = <their own listing>
 *
 * and Postgres allows it. Same for is_verified and is_featured where those
 * columns exist. The Approvals screen is a convenience for honest providers,
 * not a gate.
 *
 * ---------------------------------------------------------------------------
 * WHY A TRIGGER AND NOT COLUMN GRANTS
 *
 * The obvious fix is `revoke update ... grant update (every other column)`,
 * which is what phase108 does for tasks. It is wrong here, for two reasons:
 *
 *   1. Column privileges are granted to a ROLE, and an admin is also
 *      `authenticated`. Revoking status from that role breaks Super Admin's
 *      own approve button, which today writes straight from the browser. The
 *      brief says do not break existing Super Admin functionality, and that
 *      would have broken it on the first click.
 *
 *   2. A column list goes stale. Add a column to hotels next year and it is
 *      not in the grant, so provider edits start failing for a reason nobody
 *      will connect to this file.
 *
 * A trigger inverts both: it names only the three columns that need guarding,
 * lets is_admin() through untouched, and does not care what else the table
 * grows.
 *
 * ---------------------------------------------------------------------------
 * WHAT CHANGES FOR WHOM
 *
 *   Provider   — edits everything about their listing exactly as before, and
 *                can no longer change status, is_verified or is_featured.
 *   Super Admin— nothing. No code change, no new call path.
 *   Staff      — can approve or reject WITH the permission, and only inside
 *                their area.
 *
 * Badges stay Super Admin's: is_verified and is_featured are refused for
 * everyone except an admin, because §13 of the brief keeps trust signals with
 * the owner of the platform, and there is no permission here to grant them.
 * ============================================================ */

do $$
begin
  if to_regprocedure('public.staff_can(text, uuid)') is null then
    raise exception 'public.staff_can is missing — run phase104-staff-foundation.sql first.';
  end if;
end $$;


/* ============================================================
 * 1. THE PERMISSIONS
 * ============================================================ */
insert into public.staff_permissions (slug, module, label, description) values
  ('view_approvals',   'approvals', 'View the approval queue', 'See listings waiting for a decision'),
  ('approve_listing',  'approvals', 'Approve a listing',       'Put a listing live'),
  ('reject_listing',   'approvals', 'Reject a listing',        'Refuse a listing')
on conflict (slug) do nothing;

/* Deliberately no grant_verified_badge and no grant_featured_badge. Those are
   the platform vouching for somebody, and a permission that does not exist
   cannot be handed out in a hurry. */


/* ============================================================
 * 2. THE GUARD
 *
 * Runs BEFORE UPDATE. Compares the three guarded columns and only
 * cares if one actually changed — an owner saving a form that
 * happens to include the current status must not be refused.
 *
 * to_jsonb(old)/(new) rather than new.is_verified, because not every
 * listing table has all three columns and a trigger function
 * referencing a missing field fails at runtime on the tables that
 * lack it.
 * ============================================================ */
create or replace function public.guard_listing_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  o jsonb := to_jsonb(old);
  n jsonb := to_jsonb(new);
  v_location uuid;
  v_new_status text;
begin
  /* Admins first and cheapest. Their path is exactly what it was before this
     file existed, which is the point. */
  if public.is_admin() then
    return new;
  end if;

  /* Badges: nobody but an admin, ever. Checked before status so a request
     that changes both is refused for the stronger reason. */
  if (o ? 'is_verified' and o->'is_verified' is distinct from n->'is_verified')
     or (o ? 'is_featured' and o->'is_featured' is distinct from n->'is_featured')
  then
    raise exception
      'Verified and Featured badges are set by a Rego administrator.'
      using errcode = '42501';
  end if;

  if o->'status' is not distinct from n->'status' then
    return new;                                   -- status untouched, carry on
  end if;

  v_new_status := n->>'status';

  /* The row's area, when the table has one. staff_can() takes it into
     account, so a marketing manager covering Baltistan cannot approve a
     hotel in Hunza. A table with no location_id is checked on the
     permission alone. */
  if o ? 'location_id' then
    v_location := nullif(o->>'location_id', '')::uuid;
  end if;

  if v_new_status = 'approved' and public.staff_can('approve_listing', v_location) then
    return new;
  end if;

  if v_new_status in ('rejected', 'pending')
     and public.staff_can('reject_listing', v_location) then
    return new;
  end if;

  /* Everything else, including the owner. The message says who decides
     rather than only that they cannot — somebody reading this in their own
     dashboard should learn what happens next, not that they hit a wall. */
  raise exception
    'A listing''s status is set by the Rego team when they review it.'
    using errcode = '42501';
end $$;

comment on function public.guard_listing_status is
  'Refuses a change to status, is_verified or is_featured unless the caller '
  'is an admin, or is staff holding approve_listing / reject_listing for the '
  'listing''s area. Owners keep every other field.';


/* ============================================================
 * 3. ATTACH IT
 *
 * The same eighteen tables the rest of the team system allowlists.
 * to_regclass guard so a deployment missing one skips rather than
 * aborting and leaving half the tables unguarded — the worst
 * outcome, because it would look done.
 * ============================================================ */
do $$
declare
  t text;
begin
  foreach t in array array[
    'hotels','homestays','hostels',
    'tour_companies','tour_packages','tour_guides',
    'transport_providers','transport_services','rental_vehicles',
    'media_providers','media_services',
    'restaurants','activities','events','coworking_spaces',
    'roadside_providers','expedition_companies','expedition_professionals'
  ] loop
    if to_regclass('public.' || t) is null then
      raise notice 'skipping %, table not present', t;
      continue;
    end if;

    /* Only where there is a status column to guard. */
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t and column_name = 'status'
    ) then
      raise notice 'skipping %, no status column', t;
      continue;
    end if;

    execute format('drop trigger if exists guard_status on public.%I', t);
    execute format(
      'create trigger guard_status before update on public.%I '
      'for each row execute function public.guard_listing_status()', t
    );

    /* AND A ROW POLICY, or the trigger never runs for staff.
       phase30's p_update is `owner_email = auth.email() or is_admin()`. A
       reviewer is neither, so their UPDATE matches no rows — it does not
       error, it silently changes nothing. The guard above would have been
       the only thing in place and it would never have been reached.

       (My own test reported "staff can approve" as a pass because zero rows
       updated raises no error. Worth recording: with RLS, absence of an
       error is not evidence that anything happened.)

       Additive, like phase110 — the existing policy is untouched, and this
       one lets a reviewer see and update the row. WHICH COLUMNS they may
       change is still the trigger's decision. */
    execute format('drop policy if exists %I on public.%I', 'staff111_' || t, t);

    if exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t and column_name = 'location_id'
    ) then
      execute format($p$
        create policy %I on public.%I for all
          using (
            public.staff_can('approve_listing', location_id)
            or public.staff_can('reject_listing', location_id)
          )
          with check (
            public.staff_can('approve_listing', location_id)
            or public.staff_can('reject_listing', location_id)
          )$p$, 'staff111_' || t, t);
    else
      /* No area on this table, so the permission alone decides. */
      execute format($p$
        create policy %I on public.%I for all
          using (
            public.staff_can('approve_listing', null)
            or public.staff_can('reject_listing', null)
          )
          with check (
            public.staff_can('approve_listing', null)
            or public.staff_can('reject_listing', null)
          )$p$, 'staff111_' || t, t);
    end if;
  end loop;
end $$;


/* How many tables are actually guarded now. If this is lower than expected,
   read the notices above — a table was skipped, and a skipped table is one a
   provider can still approve themselves.
   The Supabase editor shows only the last result set, so this is last. */
select
  count(*)                                                        as tables_guarded,
  string_agg(c.relname, ', ' order by c.relname)                   as tables
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and t.tgname = 'guard_status' and not t.tgisinternal;


/* ------------------------------------------------------------------
 * ROLLBACK. Removes the guard and leaves everything else alone.
 * Running it puts the hole back, so do it only to unblock something.
 *
 *   do $$
 *   declare r record;
 *   begin
 *     for r in select c.relname from pg_trigger t
 *               join pg_class c on c.oid = t.tgrelid
 *               join pg_namespace n on n.oid = c.relnamespace
 *              where n.nspname='public' and t.tgname='guard_status'
 *                and not t.tgisinternal
 *     loop
 *       execute format('drop trigger if exists guard_status on public.%I', r.relname);
 *     end loop;
 *   end $$;
 *   drop function if exists public.guard_listing_status();
 *   delete from public.staff_permissions
 *    where slug in ('view_approvals','approve_listing','reject_listing');
 * ------------------------------------------------------------------ */
