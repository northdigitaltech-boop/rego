/* phase104 + 106 + 107 + 110, then the rollback.

   The claim being tested is the one that matters for a live database:
   phase110 is ADDITIVE. An admin's access must be identical before and
   after, and the rollback must leave the original policy standing.
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
  create table public._whoami (id uuid);
  create or replace function auth.uid() returns uuid
    language sql stable security definer
    as $fn$ select id from public._whoami limit 1 $fn$;

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

  /* Two of the real tables, with the real shape of their policies: an
     admin-only write rule created by an earlier phase. */
  create table public.events (id uuid primary key default gen_random_uuid(), title text, status text default 'draft');
  alter table public.events enable row level security;
  create policy "events_read"   on public.events for select using (status = 'published' or public.is_admin());
  create policy "events_insert" on public.events for insert with check (public.is_admin());
  create policy "events_update" on public.events for update using (public.is_admin()) with check (public.is_admin());

  create table public.ad_slides (id uuid primary key default gen_random_uuid(), title text);
  alter table public.ad_slides enable row level security;
  create policy "w92_read"   on public.ad_slides for select using (true);
  create policy "w92_insert" on public.ad_slides for insert with check (public.is_admin());
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

/* Snapshot of the admin policies BEFORE, to prove nothing was rewritten. */
const before = await q(`
  select policyname, qual, with_check from pg_policies
   where schemaname='public' and tablename='events' order by policyname`);

await step("phase110", read("supabase/phase110-module-permissions.sql"));

const after = await q(`
  select policyname, qual, with_check from pg_policies
   where schemaname='public' and tablename='events' and policyname not like 'staff110%'
   order by policyname`);

console.log("\nadditive:");
check(
  "every original events policy survives, byte for byte",
  JSON.stringify(before) === JSON.stringify(after),
  `before ${JSON.stringify(before)}\n       after  ${JSON.stringify(after)}`
);
check(
  "and a staff policy was added",
  (await q(`select count(*)::int as n from pg_policies
             where schemaname='public' and policyname = 'staff110_events'`))[0].n === 1
);

/* ---- behaviour ---- */
const A = "11111111-1111-1111-1111-111111111111";
const ADMIN = "22222222-2222-2222-2222-222222222222";
await db.exec(`
  insert into public.profiles (id, email, role) values
    ('${A}','a@example.com','customer'), ('${ADMIN}','admin@example.com','admin');
  insert into public._whoami (id) values ('${A}');
`);

const mkt = (await q(`select id from public.staff_departments where slug='marketing'`))[0].id;
const role = (await q(`select id from public.staff_roles where department_id='${mkt}' limit 1`))[0].id;
const code = (await q(`select public.next_employee_code('${mkt}') as c`))[0].c;
await db.exec(`insert into public.staff_members
  (profile_id, employee_code, referral_code, department_id, role_id)
  values ('${A}','${code}','${code}','${mkt}','${role}')`);

await db.exec(`
  alter table public.events force row level security;
  grant usage on schema public to authenticated;
  grant select, insert, update, delete on public.events to authenticated;
  grant select on public.staff_members, public.staff_departments, public.staff_roles,
                  public.staff_permissions, public.staff_role_permissions,
                  public.staff_permission_grants, public.staff_scopes,
                  public.locations, public.profiles to authenticated;
`);

const asUser = async (id) => {
  await db.exec(`reset role`);
  await db.exec(`update public._whoami set id='${id}'`);
  await db.exec(`set role authenticated`);
};

console.log("\nbehaviour:");

await asUser(A);
await tryIt(`insert into public.events (title) values ('Before the grant')`);
check(
  "a team member without the permission cannot write",
  (await q(`select count(*)::int as n from public.events`))[0].n === 0
);

/* Grant it on the role, the way the Roles screen does. */
await db.exec(`reset role`);
await db.exec(`
  insert into public.staff_role_permissions (role_id, permission_id)
  select '${role}', id from public.staff_permissions where slug = 'manage_events'
  on conflict do nothing`);

await asUser(A);
check(
  "with manage_events they can",
  (await tryIt(`insert into public.events (title) values ('After the grant')`)) === null
);
check(
  "and they can read it back",
  (await q(`select count(*)::int as n from public.events`))[0].n === 1
);
check(
  "but still not another module's table",
  (await tryIt(`insert into public.ad_slides (title) values ('Not mine')`)) !== null
);

/* Suspension reaches here too, through staff_can. */
await db.exec(`reset role`);
await db.exec(`update public.staff_members set status='suspended' where profile_id='${A}'`);
await asUser(A);
await tryIt(`insert into public.events (title) values ('While suspended')`);
/* COUNTED AS SUPERUSER, not as the suspended member.
   Asking them how many rows exist asks a question their own policy answers
   with 0 — so the check would pass whether or not the insert was refused,
   which is the same shape of test error that bit me in phase107 and phase110
   both. Read the table from outside the policy. */
await db.exec(`reset role`);
check(
  "a suspended member loses it immediately",
  (await q(`select count(*)::int as n from public.events`))[0].n === 1,
  "the insert went through while suspended"
);

await db.exec(`update public.staff_members set status='active' where profile_id='${A}'`);

await asUser(ADMIN);
check(
  "an admin is unaffected throughout",
  (await tryIt(`insert into public.events (title) values ('Admin still works')`)) === null
);

await db.exec(`reset role`);

console.log("\nrollback:");
await step("phase110 rollback", `
  do $$
  declare r record;
  begin
    for r in select tablename, policyname from pg_policies
              where schemaname = 'public' and policyname like 'staff110\\_%'
    loop
      execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
    end loop;
  end $$;
  drop function if exists public.staff_manages(text);
  delete from public.staff_permissions where module = 'modules';
`);

const restored = await q(`
  select policyname, qual, with_check from pg_policies
   where schemaname='public' and tablename='events' order by policyname`);
check(
  "after rollback the original policies are exactly as they started",
  JSON.stringify(before) === JSON.stringify(restored),
  JSON.stringify(restored)
);

console.log(failed ? "\nFAILED" : "\nall checks passed");
process.exit(failed ? 1 : 0);
