/* ============================================================
 * phase138 — an approved partner's new listings go live at once
 *
 * ADDITIVE AND IDEMPOTENT. One helper, one trigger function, one
 * BEFORE INSERT trigger per listing table. ROLLBACK at the bottom.
 * No table, column or row is changed or removed.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT DOES
 *
 * A partner is reviewed ONCE, when they register. After an admin has
 * approved any one of their listings, they are a trusted partner and
 * whatever they add next — a second vehicle, a tour package, a menu,
 * another activity — is inserted as `approved` and is live straight away.
 *
 * Until then (a brand-new partner) every new row is `pending`, exactly
 * as before.
 *
 * Edits to existing listings are handled in the app
 * (lib/pending-edits.ts → updateOrQueue now writes directly). This file
 * is only about NEW rows.
 *
 * ---------------------------------------------------------------------------
 * WHY THE DATABASE DECIDES, NOT THE BROWSER
 *
 * phase111 guards UPDATE: an owner cannot change status. INSERT was never
 * guarded, so an owner could already insert a row with status='approved'
 * using the public anon key. Letting the browser send 'approved' for
 * trusted partners would have built on that hole.
 *
 * This trigger closes it instead. For anyone who is not an admin, the
 * status of a new row is set HERE, from facts in the database:
 *
 *     owner already has an approved listing  →  'approved'
 *     otherwise                              →  'pending'
 *
 * Whatever status the browser sent is ignored. Admins are untouched, and
 * so are service-role writes (no signed-in user), which keep the status
 * they were given.
 *
 * ---------------------------------------------------------------------------
 * NOT INCLUDED: events. Their status means published/draft, not
 * approval, so they are left alone.
 *
 * ---------------------------------------------------------------------------
 * WHAT ADMINS KEEP
 *
 * Approve, reject and suspend work exactly as before. A trusted partner
 * whose listing is suspended or rejected later is still trusted while
 * any OTHER listing of theirs is approved; suspend all of them to stop
 * auto-approval.
 * ============================================================ */


/* ============================================================
 * 1. IS THIS PARTNER ALREADY APPROVED SOMEWHERE?
 *
 * security definer so it can see rows RLS would hide from the
 * caller (another table's listings). It returns only a boolean.
 * Tables or columns missing on a given deployment are skipped
 * rather than failing.
 * ============================================================ */
create or replace function public.partner_is_approved(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  t text;
  found boolean;
begin
  if p_email is null or btrim(p_email) = '' then
    return false;
  end if;

  foreach t in array array[
    'hotels','homestays','hostels',
    'tour_companies','tour_packages','tour_guides',
    'transport_providers','transport_services','rental_vehicles',
    'media_providers','media_services',
    'restaurants','activities','coworking_spaces','transports',
    'roadside_providers','expedition_companies','expedition_professionals'
  ] loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t and column_name = 'owner_email'
    ) or not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t and column_name = 'status'
    ) then
      continue;
    end if;

    execute format(
      'select exists (select 1 from public.%I
                       where lower(owner_email) = lower($1)
                         and status = ''approved'')', t)
      into found
      using btrim(p_email);

    if found then
      return true;
    end if;
  end loop;

  return false;
end $$;

comment on function public.partner_is_approved is
  'True when the email owns at least one approved listing in any listing table.';

revoke all on function public.partner_is_approved(text) from public;
grant execute on function public.partner_is_approved(text) to authenticated;


/* ============================================================
 * 2. THE STATUS OF A NEW ROW
 * ============================================================ */
create or replace function public.set_new_listing_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  /* Service-role and other sessionless writes: leave as given. */
  if auth.uid() is null then
    return new;
  end if;

  /* Admins set whatever they set. */
  if public.is_admin() then
    return new;
  end if;

  if public.partner_is_approved(auth.email()) then
    new.status := 'approved';
  else
    new.status := 'pending';
  end if;

  return new;
end $$;

comment on function public.set_new_listing_status is
  'BEFORE INSERT: approved partners'' new rows are approved; everyone else''s '
  'are pending. Ignores the status sent by the browser. Admins untouched.';


/* ============================================================
 * 3. ATTACH IT — only where there is a status column.
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
    'restaurants','activities','coworking_spaces','transports',
    'roadside_providers','expedition_companies','expedition_professionals'
  ] loop
    if to_regclass('public.' || t) is null then
      raise notice 'skipping %, table not present', t;
      continue;
    end if;
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t and column_name = 'status'
    ) then
      raise notice 'skipping %, no status column', t;
      continue;
    end if;

    execute format('drop trigger if exists set_new_status on public.%I', t);
    execute format(
      'create trigger set_new_status before insert on public.%I '
      'for each row execute function public.set_new_listing_status()', t
    );
  end loop;
end $$;


/* Which tables now carry the trigger. The Supabase editor shows only the
   last result, so this is last. */
select
  count(*)                                          as tables_with_trigger,
  string_agg(c.relname, ', ' order by c.relname)    as tables
  from pg_trigger tr
  join pg_class c on c.oid = tr.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and tr.tgname = 'set_new_status' and not tr.tgisinternal;


/* ------------------------------------------------------------------
 * ROLLBACK — puts back exactly the previous behaviour (new rows take
 * the status the browser or the column default gives them).
 *
 * do $$
 * declare t text;
 * begin
 *   foreach t in array array[
 *     'hotels','homestays','hostels','tour_companies','tour_packages','tour_guides',
 *     'transport_providers','transport_services','rental_vehicles',
 *     'media_providers','media_services','restaurants','activities',
 *     'coworking_spaces','transports','roadside_providers','expedition_companies',
 *     'expedition_professionals'
 *   ] loop
 *     if to_regclass('public.' || t) is not null then
 *       execute format('drop trigger if exists set_new_status on public.%I', t);
 *     end if;
 *   end loop;
 * end $$;
 * drop function if exists public.set_new_listing_status();
 * drop function if exists public.partner_is_approved(text);
 * ------------------------------------------------------------------ */
