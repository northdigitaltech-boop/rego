-- ============================================================
-- phase130 — close two routes to becoming an administrator.
--
-- SEC-001 and SEC-002. Both are P0: each one, on its own, turns
-- an anonymous visitor into a full Rego administrator using
-- nothing but the public anon key that ships in every page.
--
-- ---------------------------------------------------------------------------
-- SEC-001 — SIGNUP METADATA IS COPIED STRAIGHT INTO profiles.role
--
-- phase29's handle_new_user() does this:
--
--     coalesce(new.raw_user_meta_data->>'role', 'customer')
--
-- raw_user_meta_data is whatever the browser passed to
-- supabase.auth.signUp({ options: { data: {...} } }). It is
-- attacker-controlled, in full, with no server in the path.
--
--     supabase.auth.signUp({ email, password,
--       options: { data: { role: 'admin' } } })
--
-- That is the entire attack. The new account has
-- profiles.role = 'admin' the moment it is created, which makes
-- public.is_admin() true, which — as phase104's own header says
-- — means they "instantly pass all 218 policies".
--
-- SEC-002 — A PROFILE OWNER MAY REWRITE THEIR OWN ROLE
--
-- phase29 also created:
--
--     create policy "profiles_self_update" on public.profiles
--       for update using (auth.uid() = id);
--
-- With no WITH CHECK, Postgres reuses the USING expression as
-- the check — and `auth.uid() = id` is still true after the row
-- changes role to 'admin'. No trigger, no column grant and no
-- constraint anywhere in the other 136 migrations restricts it.
-- So any existing signed-in traveller can PATCH their own
-- profile row and become an administrator.
--
-- ---------------------------------------------------------------------------
-- WHY THE FIX IS A TRIGGER AND NOT A POLICY CHANGE
--
-- The tempting fix is to narrow profiles_self_update. It does
-- not work: RLS policies gate WHICH ROWS may be written, not
-- which COLUMNS, so any policy permitting a user to update their
-- own display name also permits them to update their own role in
-- the same statement.
--
-- Column privileges are the other option, and phase111 already
-- documents why they backfire here: privileges are granted to a
-- ROLE, and an administrator is also `authenticated`, so
-- revoking update(role) from authenticated disables Super Admin
-- along with everyone else.
--
-- A trigger sees the old row and the new row and the caller, so
-- it can allow exactly the case that should be allowed.
--
-- NOTHING LEGITIMATE CHANGES
--   * Signing up as a traveller or a partner: unchanged.
--   * /api/admin/staff creating a staff member: unchanged. It
--     uses the service role, which has no JWT, so auth.uid() is
--     null and the trigger stands aside.
--   * An admin promoting someone in the admin panel: unchanged.
--   * Nothing depends on profiles.role = 'staff' — staff
--     capability comes from staff_members + staff_can(), and no
--     SQL and no component compares role to 'staff'. Verified
--     before writing this.
-- ---------------------------------------------------------------------------

-- ------------------------------------------------------------
-- SEC-001 — signup can never mint an administrator.
--
-- Only the privileged value is rejected. 'customer', 'partner',
-- 'traveler', 'staff', 'business' and anything else the app uses
-- today pass through untouched, so this cannot break a flow that
-- works now.
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
  returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  requested text := coalesce(new.raw_user_meta_data->>'role', 'customer');
begin
  /* An account may not be born an administrator. Promotion is a deliberate
     act by an existing admin, never a field in a signup payload. */
  if lower(requested) = 'admin' then
    requested := 'customer';
  end if;

  insert into public.profiles (id, email, full_name, role, business_category, avatar)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    requested,
    new.raw_user_meta_data->>'business_category',
    new.raw_user_meta_data->>'avatar'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- SEC-002 — only an administrator may change a role.
-- ------------------------------------------------------------
create or replace function public.guard_profile_role_change()
  returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role then
    /* No JWT at all means the service role, a database trigger, or the SQL
       editor — none of which is a browser, and all of which are already
       trusted. This is what keeps /api/admin/staff and any future server
       route working without granting anything to the client. */
    if auth.uid() is null then
      return new;
    end if;

    /* Read old.role's table directly rather than calling is_admin(): the
       caller might be updating their OWN row, and is_admin() would read the
       row mid-update. Checking the committed state is the honest question. */
    if exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role = 'admin'
    ) then
      return new;
    end if;

    raise exception 'Only an administrator may change a profile role'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard
  before update on public.profiles
  for each row execute function public.guard_profile_role_change();

-- ============================================================
-- RUN THIS AFTERWARDS — CHECK WHETHER IT ALREADY HAPPENED
--
-- Both holes have been open since phase29. Closing them does not
-- undo an escalation that already occurred, and an attacker who
-- promoted themselves keeps the role. Review every administrator
-- and remove any you do not recognise:
--
--   select p.id, p.email, p.role, p.created_at, u.last_sign_in_at
--     from public.profiles p
--     left join auth.users u on u.id = p.id
--    where p.role = 'admin'
--    order by p.created_at;
--
-- Demote anything unexpected (as an admin, or from the SQL
-- editor, both of which the trigger permits):
--
--   update public.profiles set role = 'customer'
--    where email = 'whoever@example.com';
--
-- Also worth a look — accounts whose signup payload asked for a
-- role that is not one of the ordinary ones:
--
--   select id, email, raw_user_meta_data->>'role' as asked_for
--     from auth.users
--    where raw_user_meta_data->>'role' is not null
--      and raw_user_meta_data->>'role' not in
--          ('customer','partner','traveler','staff','business');
-- ============================================================

-- ============================================================
-- ROLLBACK
--
-- Restores both holes. Only do this if the trigger is proven to
-- be blocking a legitimate flow, and prefer fixing that flow.
--
--   drop trigger if exists profiles_role_guard on public.profiles;
--   drop function if exists public.guard_profile_role_change();
--   -- and re-run phase29's handle_new_user() definition to
--   -- restore the metadata passthrough.
-- ============================================================
