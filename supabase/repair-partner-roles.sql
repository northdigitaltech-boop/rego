-- ============================================================
-- Give the stranded partners back the role they asked for.
--
-- Run the whole file at once. It is a single transaction: if any
-- step fails, nothing changes.
--
-- WHAT IT TOUCHES
--   Only accounts where auth metadata says 'partner' and
--   profiles.role does not. That is verdicts 1 and 2 from
--   check-partner-role-2.sql — the people who picked Business /
--   Partner and were silently filed as travellers.
--
-- WHAT IT WILL NOT TOUCH
--   Verdict 3 (owns a business but picked Traveler) — that is a
--   person's own choice and may be deliberate; ask them first.
--   Verdict 4 (genuine travellers).
--   Anyone already 'partner', 'admin' or anything else.
--
-- WHY IT IS ALLOWED TO DO THIS
--   The SQL editor runs as the service role, so auth.uid() is
--   null and guard_profile_role_change() steps aside. Same
--   exemption /api/auth/choose-role uses. The guard is not being
--   weakened or dropped — it stays exactly as it is.
--
-- ROLLBACK
--   Step 1 saves every affected row into a real table,
--   profiles_role_repair_backup, BEFORE anything changes. The
--   undo statement is at the bottom and reads from that table,
--   so it works even in a new session tomorrow.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Snapshot first. A backup written after the change is not a
--    backup, so this runs before the update and inside the same
--    transaction — if the update fails, the snapshot rolls back
--    with it and nothing is left half-done.
-- ------------------------------------------------------------
create table if not exists public.profiles_role_repair_backup (
  id                uuid primary key,
  email             text,
  old_role          text,
  old_category      text,
  backed_up_at      timestamptz not null default now()
);

insert into public.profiles_role_repair_backup (id, email, old_role, old_category)
select p.id, p.email, p.role, p.business_category
  from public.profiles p
  join auth.users u on u.id = p.id
 where lower(coalesce(u.raw_user_meta_data->>'role','')) = 'partner'
   /* Only a role that means "never set up": customer is the column
      default, traveler is the app's word for the same thing. Testing
      for <> 'partner' would have swept in ADMIN accounts and demoted
      them — an admin whose own signup metadata happens to say partner
      would have lost the admin panel. Caught in testing, which is why
      this is an allow-list and not a deny-list. */
   and lower(coalesce(p.role,'')) in ('customer','traveler','')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 2. The repair.
--
--    business_category comes from the profile if it already has
--    one, otherwise from what they chose at signup. coalesce in
--    that order so a category an admin has since corrected is
--    never overwritten by the original signup value.
-- ------------------------------------------------------------
update public.profiles p
   set role = 'partner',
       business_category = coalesce(
         nullif(p.business_category, ''),
         u.raw_user_meta_data->>'business_category'
       )
  from auth.users u
 where u.id = p.id
   and lower(coalesce(u.raw_user_meta_data->>'role','')) = 'partner'
   and lower(coalesce(p.role,'')) in ('customer','traveler','');

-- ------------------------------------------------------------
-- 3. Prove it worked before committing.
--
--    If any account that asked for partner is still not one, the
--    exception aborts the transaction and the database is left
--    exactly as it was.
-- ------------------------------------------------------------
do $$
declare remaining int; repaired int;
begin
  select count(*) into remaining
    from auth.users u
    join public.profiles p on p.id = u.id
   where lower(coalesce(u.raw_user_meta_data->>'role','')) = 'partner'
     and lower(coalesce(p.role,'')) in ('customer','traveler','');

  select count(*) into repaired from public.profiles_role_repair_backup;

  if remaining > 0 then
    raise exception 'Repair incomplete: % account(s) still not partner. Nothing committed.', remaining;
  end if;

  raise notice '>>> repaired % account(s). 0 left stranded.', repaired;
end $$;

commit;

-- ------------------------------------------------------------
-- 4. Check the result (safe to run on its own afterwards).
-- ------------------------------------------------------------
select b.email, b.old_role, p.role as new_role,
       b.old_category, p.business_category as new_category
  from public.profiles_role_repair_backup b
  join public.profiles p on p.id = b.id
 order by b.email;

-- ============================================================
-- UNDO — only if something looks wrong.
--
--   update public.profiles p
--      set role = b.old_role,
--          business_category = b.old_category
--     from public.profiles_role_repair_backup b
--    where b.id = p.id;
--
-- Once you are satisfied, the backup table can go:
--
--   drop table public.profiles_role_repair_backup;
-- ============================================================
