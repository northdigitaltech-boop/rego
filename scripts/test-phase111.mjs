/* phase104 + 106 + 107 + 111, then the rollback.

   The claims being tested, in order of how much they would cost if wrong:

     1. An owner can no longer approve their own listing.
     2. An owner can still edit EVERYTHING ELSE about it. If this broke,
        every provider on Rego would be stuck, which is worse than the hole
        this file closes.
     3. Super Admin's existing path is untouched — no new call, no change.
     4. Staff can approve only with the permission, and only in their area.
*/

import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SQL_DIR = process.env.SQL_DIR || ".";
const read = (f) => readFileSync(join(SQL_DIR, f), "utf8");
const db = await new PGlite();

await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema if not exists auth;
  create table public._whoami (id uuid, email text);
  create or replace function auth.uid() returns uuid
    language sql stable security definer as $fn$ select id from public._whoami limit 1 $fn$;
  create or replace function auth.email() returns text
    language sql stable security definer as $fn$ select email from public._whoami limit 1 $fn$;

  create table public.profiles (
    id uuid primary key, email text, full_name text, role text default 'customer');

  create or replace function public.is_admin() returns boolean
    language sql stable security definer as $fn$
      select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    $fn$;

  create table public.markets (id uuid primary key default gen_random_uuid(), slug text, name text);
  create table public.locations (
    id uuid primary key default gen_random_uuid(),
    market_id uuid, parent_id uuid,
    location_type text not null, name text not null, slug text not null,
    ancestors uuid[] not null default '{}');

  /* hotels with the real phase30 policy, and the columns that matter. */
  create table public.hotels (
    id uuid primary key default gen_random_uuid(),
    name text, price numeric, description text,
    owner_email text,
    location_id uuid references public.locations(id),
    status text default 'pending',
    is_verified boolean default false,
    is_featured boolean default false
  );
  alter table public.hotels enable row level security;
  create policy "p_read"   on public.hotels for select
    using (status = 'approved' or owner_email = auth.email() or public.is_admin());
  create policy "p_update" on public.hotels for update
    using (owner_email = auth.email() or public.is_admin())
    with check (owner_email = auth.email() or public.is_admin());
`);

let failed = false;
const check = (label, cond, extra) => {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}`);
  if (!cond) { failed = true; if (extra) console.log(`       ${extra}`); }
};
const q = async (sql) => (await db.query(sql)).rows;
const tryIt = async (sql) => {
  try { await db.exec(sql); return null; } catch (e) { return e.message; }
};
const step = async (label, sql) => {
  try { await db.exec(sql); console.log(`  ok   ${label}`); }
  catch (e) { console.log(`  FAIL ${label}\n       ${e.message}`); process.exit(1); }
};

console.log("apply:");
await step("phase104", read("supabase/phase104-staff-foundation.sql"));
await step("phase106", read("supabase/phase106-staff-portal-profile.sql"));
await step("phase107", read("supabase/phase107-staff-leads.sql"));
await step("phase111", read("supabase/phase111-listing-status-guard.sql"));

const OWNER = "11111111-1111-1111-1111-111111111111";
const STAFF = "22222222-2222-2222-2222-222222222222";
const ADMIN = "33333333-3333-3333-3333-333333333333";

await db.exec(`
  insert into public.profiles (id, email, role) values
    ('${OWNER}','owner@example.com','partner'),
    ('${STAFF}','staff@example.com','customer'),
    ('${ADMIN}','admin@example.com','admin');
  insert into public._whoami (id, email) values ('${OWNER}','owner@example.com');

  insert into public.markets (id, slug, name)
    values ('44444444-4444-4444-4444-444444444444','pk','Pakistan');
  insert into public.locations (id, market_id, location_type, name, slug, ancestors)
    values ('55555555-5555-5555-5555-555555555555',
            '44444444-4444-4444-4444-444444444444','division','Baltistan','baltistan','{}');
  insert into public.locations (id, market_id, parent_id, location_type, name, slug, ancestors)
    values ('66666666-6666-6666-6666-666666666666',
            '44444444-4444-4444-4444-444444444444',
            '55555555-5555-5555-5555-555555555555','district','Skardu','skardu',
            '{55555555-5555-5555-5555-555555555555}');
  insert into public.locations (id, market_id, location_type, name, slug, ancestors)
    values ('77777777-7777-7777-7777-777777777777',
            '44444444-4444-4444-4444-444444444444','district','Hunza','hunza','{}');

  insert into public.hotels (id, name, price, owner_email, location_id)
    values ('88888888-8888-8888-8888-888888888888', 'Mountain View', 5000,
            'owner@example.com', '66666666-6666-6666-6666-666666666666');
`);

const mkt = (await q(`select id from public.staff_departments where slug='marketing'`))[0].id;
const roleId = (await q(`select id from public.staff_roles where department_id='${mkt}' limit 1`))[0].id;
const code = (await q(`select public.next_employee_code('${mkt}') as c`))[0].c;
await db.exec(`insert into public.staff_members
  (profile_id, employee_code, referral_code, department_id, role_id)
  values ('${STAFF}','${code}','${code}','${mkt}','${roleId}')`);

await db.exec(`
  alter table public.hotels force row level security;
  grant usage on schema public to authenticated;
  grant select, insert, update, delete on public.hotels to authenticated;
  grant select on public.staff_members, public.staff_departments, public.staff_roles,
                  public.staff_permissions, public.staff_role_permissions,
                  public.staff_permission_grants, public.staff_scopes,
                  public.locations, public.profiles to authenticated;
`);

const asUser = async (id, email) => {
  await db.exec(`reset role`);
  await db.exec(`update public._whoami set id='${id}', email='${email}'`);
  await db.exec(`set role authenticated`);
};
const statusNow = async () => {
  await db.exec(`reset role`);
  const r = (await q(`select status, is_verified, name, price from public.hotels
                       where id='88888888-8888-8888-8888-888888888888'`))[0];
  return r;
};

console.log("\nthe owner:");

await asUser(OWNER, "owner@example.com");

const selfApprove = await tryIt(
  `update public.hotels set status='approved' where id='88888888-8888-8888-8888-888888888888'`);
check("cannot approve their own listing", selfApprove !== null, "it was allowed");
check("and the row is untouched", (await statusNow()).status === "pending");

await asUser(OWNER, "owner@example.com");
await tryIt(`update public.hotels set is_verified=true
              where id='88888888-8888-8888-8888-888888888888'`);
check(
  "cannot give themselves the Verified badge",
  (await statusNow()).is_verified === false
);

/* THE ONE THAT WOULD HURT MOST IF WRONG. */
await asUser(OWNER, "owner@example.com");
check(
  "can still edit their own listing",
  (await tryIt(`update public.hotels
                   set name='Mountain View Hotel', price=6500, description='Now with parking'
                 where id='88888888-8888-8888-8888-888888888888'`)) === null
);
const edited = await statusNow();
check("and the edit landed", edited.name === "Mountain View Hotel" && Number(edited.price) === 6500);

/* Saving a form that re-sends the unchanged status must not be refused. */
await asUser(OWNER, "owner@example.com");
check(
  "re-saving the SAME status is not treated as a change",
  (await tryIt(`update public.hotels set name='Mountain View Hotel 2', status='pending'
                 where id='88888888-8888-8888-8888-888888888888'`)) === null
);

console.log("\nstaff:");

await asUser(STAFF, "staff@example.com");
await tryIt(`update public.hotels set status='approved'
              where id='88888888-8888-8888-8888-888888888888'`);
check(
  "without approve_listing the status does not move",
  (await statusNow()).status === "pending"
);

await db.exec(`reset role`);
await db.exec(`
  insert into public.staff_role_permissions (role_id, permission_id)
  select '${roleId}', id from public.staff_permissions where slug='approve_listing'
  on conflict do nothing`);

await asUser(STAFF, "staff@example.com");
await tryIt(`update public.hotels set status='approved'
              where id='88888888-8888-8888-8888-888888888888'`);
check(
  "with the permission but NO area, the status still does not move",
  (await statusNow()).status === "pending",
  "scope was not enforced"
);

/* Scope them to Hunza — the wrong district. */
await db.exec(`reset role`);
await db.exec(`
  insert into public.staff_scopes (staff_id, location_id, includes_descendants)
  select id, '77777777-7777-7777-7777-777777777777', true
    from public.staff_members where profile_id='${STAFF}'`);

await asUser(STAFF, "staff@example.com");
await tryIt(`update public.hotels set status='approved'
              where id='88888888-8888-8888-8888-888888888888'`);
check(
  "scoped to the wrong district, still no",
  (await statusNow()).status === "pending"
);

/* Now Baltistan, which contains Skardu. */
await db.exec(`reset role`);
await db.exec(`
  update public.staff_scopes set location_id='55555555-5555-5555-5555-555555555555'
   where staff_id = (select id from public.staff_members where profile_id='${STAFF}')`);

await asUser(STAFF, "staff@example.com");
/* Asserted on the DATA, not on the absence of an error. An UPDATE that
   matches no rows under RLS raises nothing, so `=== null` alone reported a
   pass here while the reviewer was being filtered out entirely. */
await tryIt(`update public.hotels set status='approved'
              where id='88888888-8888-8888-8888-888888888888'`);
check(
  "scoped to the division above it, the approval lands",
  (await statusNow()).status === "approved",
  "status did not change — the row policy may be filtering the reviewer out"
);

await asUser(STAFF, "staff@example.com");
await tryIt(`update public.hotels set is_verified=true
              where id='88888888-8888-8888-8888-888888888888'`);
check(
  "but they still cannot award the Verified badge",
  (await statusNow()).is_verified === false
);

console.log("\nsuper admin:");

await asUser(ADMIN, "admin@example.com");
check(
  "approves exactly as before, no new call path",
  (await tryIt(`update public.hotels set status='rejected'
                 where id='88888888-8888-8888-8888-888888888888'`)) === null
);
check(
  "and awards badges",
  (await tryIt(`update public.hotels set is_verified=true, is_featured=true
                 where id='88888888-8888-8888-8888-888888888888'`)) === null
);

/* Suspension has to reach here too. */
await db.exec(`reset role`);
await db.exec(`update public.staff_members set status='suspended' where profile_id='${STAFF}'`);
await db.exec(`update public.hotels set status='pending'
                where id='88888888-8888-8888-8888-888888888888'`);
await asUser(STAFF, "staff@example.com");
await tryIt(`update public.hotels set status='approved'
              where id='88888888-8888-8888-8888-888888888888'`);
check(
  "a suspended reviewer cannot approve",
  (await statusNow()).status === "pending"
);

await db.exec(`reset role`);

console.log("\nrollback:");
await step("phase111 rollback", `
  do $$
  declare r record;
  begin
    for r in select c.relname from pg_trigger t
              join pg_class c on c.oid = t.tgrelid
              join pg_namespace n on n.oid = c.relnamespace
             where n.nspname='public' and t.tgname='guard_status' and not t.tgisinternal
    loop
      execute format('drop trigger if exists guard_status on public.%I', r.relname);
    end loop;
  end $$;
  drop function if exists public.guard_listing_status();
  delete from public.staff_permissions
   where slug in ('view_approvals','approve_listing','reject_listing');
`);

console.log(failed ? "\nFAILED" : "\nall checks passed");
process.exit(failed ? 1 : 0);
