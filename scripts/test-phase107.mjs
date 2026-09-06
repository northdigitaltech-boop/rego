/* phase104 + phase106 + phase107 against an in-memory Postgres, then the
   rollback. Runs every file to the end.

   The point of this one is the POLICIES. A lead table with a wrong policy
   looks perfect until somebody reads a colleague's pipeline, so the checks
   below actually sign in as three different people and try.

     node scripts/test-phase107.mjs      (from a dir with @electric-sql/pglite)
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
  /* SECURITY DEFINER because the real auth.uid() reads a JWT claim, not a
     table. Without it every policy fails on a permission check for _whoami
     — an artefact of the harness that would look like a policy bug. */
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
`);

let failed = false;
const check = (label, cond, extra) => {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}`);
  if (!cond) {
    failed = true;
    if (extra) console.log(`       ${extra}`);
  }
};
const q = async (sql) => (await db.query(sql)).rows;

const step = async (label, sql) => {
  try {
    await db.exec(sql);
    console.log(`  ok   ${label}`);
  } catch (e) {
    console.log(`  FAIL ${label}\n       ${e.message}`);
    process.exit(1);
  }
};

console.log("apply:");
await step("phase104", read("supabase/phase104-staff-foundation.sql"));
await step("phase106", read("supabase/phase106-staff-portal-profile.sql"));
await step("phase107", read("supabase/phase107-staff-leads.sql"));

/* ---- three people: two in marketing, one in operations ---- */
const MKT_A = "11111111-1111-1111-1111-111111111111";
const MKT_B = "22222222-2222-2222-2222-222222222222";
const OPS_C = "33333333-3333-3333-3333-333333333333";

await db.exec(`
  insert into public.profiles (id, email, role) values
    ('${MKT_A}', 'a@example.com', 'customer'),
    ('${MKT_B}', 'b@example.com', 'customer'),
    ('${OPS_C}', 'c@example.com', 'customer');
  insert into public._whoami (id) values ('${MKT_A}');
`);

const deptOf = async (slug) =>
  (await q(`select id from public.staff_departments where slug = '${slug}'`))[0]?.id;
const roleIn = async (dept) =>
  (await q(`select id from public.staff_roles where department_id = '${dept}' limit 1`))[0]?.id;

const mkt = await deptOf("marketing");
const ops = (await deptOf("operations")) ?? (await deptOf("verification"));
const mktRole = await roleIn(mkt);
const opsRole = await roleIn(ops);
check("phase104 seeded a second department to test against", Boolean(ops && opsRole));

const add = async (profile, dept, role) => {
  const code = (await q(`select public.next_employee_code('${dept}') as c`))[0].c;
  await db.exec(`
    insert into public.staff_members
      (profile_id, employee_code, referral_code, department_id, role_id)
    values ('${profile}', '${code}', '${code}', '${dept}', '${role}')`);
  return code;
};
await add(MKT_A, mkt, mktRole);
await add(MKT_B, mkt, mktRole);
await add(OPS_C, ops, opsRole);

/* PGlite runs as superuser, which bypasses RLS. Force it on so the policies
   are actually exercised — without this every check below passes for the
   wrong reason. */
/* Grants BEFORE `set role`, or they run as the role being granted to and are
   refused. Supabase gives `authenticated` these grants already; here they
   have to be made by hand. */
await db.exec(`
  alter table public.staff_leads force row level security;
  alter table public.staff_activities force row level security;
  grant usage on schema public to authenticated;
  grant select, insert, update, delete
    on public.staff_leads, public.staff_activities to authenticated;
  grant select on public.staff_members, public.staff_departments,
                   public.staff_roles, public.staff_permissions,
                   public.staff_role_permissions, public.staff_permission_grants,
                   public.staff_scopes, public.locations, public.profiles
    to authenticated;
`);

const asUser = async (id) => {
  await db.exec(`reset role`);
  await db.exec(`update public._whoami set id = '${id}'`);
  await db.exec(`set role authenticated`);
};

const tryIt = async (sql) => {
  try {
    await db.exec(sql);
    return null;
  } catch (e) {
    return e.message;
  }
};

console.log("\npolicies:");

await asUser(MKT_A);
const myId = async () => (await q(`select public.my_staff_id() as v`))[0].v;
const aId = await myId();

check(
  "a marketing member can file their own lead",
  (await tryIt(`
    insert into public.staff_leads (staff_id, department_id, business_name, created_by)
    values ('${aId}', '${mkt}', 'Hunza Grand Hotel', '${MKT_A}')`)) === null
);

await asUser(MKT_B);
const bId = await myId();

check(
  "they CANNOT file a lead under a colleague",
  (await tryIt(`
    insert into public.staff_leads (staff_id, department_id, business_name, created_by)
    values ('${aId}', '${mkt}', 'Stolen credit', '${MKT_B}')`)) !== null
);

check(
  "they cannot forge created_by either",
  (await tryIt(`
    insert into public.staff_leads (staff_id, department_id, business_name, created_by)
    values ('${bId}', '${mkt}', 'Wrong author', '${MKT_A}')`)) !== null
);

/* view_leads is not on the seeded marketing role unless phase104 granted it;
   whichever it is, the department boundary must hold. */
await asUser(OPS_C);
const opsSees = (await q(`select count(*)::int as n from public.staff_leads`))[0].n;
check("another department sees none of it", opsSees === 0, `saw ${opsSees}`);

await asUser(MKT_A);
const mineSeen = (await q(`select count(*)::int as n from public.staff_leads`))[0].n;
check("the owner sees their own lead", mineSeen === 1, `saw ${mineSeen}`);

const leadId = (await q(`select id from public.staff_leads limit 1`))[0].id;

check(
  "the owner can move it along",
  (await tryIt(`update public.staff_leads set stage = 'contacted' where id = '${leadId}'`)) === null
);

check(
  "the owner cannot hand it to somebody else",
  (await tryIt(`update public.staff_leads set staff_id = '${bId}' where id = '${leadId}'`)) !== null
);

const touched = (await q(`select updated_by, updated_at from public.staff_leads where id = '${leadId}'`))[0];
check("the trigger stamped updated_by without being asked", touched.updated_by === MKT_A);

/* Activity log */
check(
  "an activity can be logged against the lead",
  (await tryIt(`
    insert into public.staff_activities (staff_id, lead_id, kind, note)
    values ('${aId}', '${leadId}', 'call', 'Spoke to the owner')`)) === null
);

/* THESE THREE ASSERT ON ROWS, NOT ON EXCEPTIONS.
   With RLS, an UPDATE or DELETE that no policy permits does not raise — it
   matches nothing and silently affects zero rows. That IS the protection,
   but a test expecting an error reports a failure for the wrong reason, and
   the same test would report a PASS for the wrong reason the day somebody
   adds a policy that errors instead of one that permits. Read the data. */
await tryIt(`update public.staff_activities set note = 'Actually it went well'`);
check(
  "the log cannot be rewritten",
  (await q(`select note from public.staff_activities limit 1`))[0]?.note ===
    "Spoke to the owner"
);

await tryIt(`delete from public.staff_activities`);
check(
  "the log cannot be deleted by the person who wrote it",
  (await q(`select count(*)::int as n from public.staff_activities`))[0].n === 1
);

await tryIt(`delete from public.staff_leads where id = '${leadId}'`);
check(
  "nobody can delete a lead to make it disappear",
  (await q(`select count(*)::int as n from public.staff_leads`))[0].n === 1
);

/* Suspension has to reach here too. */
await db.exec(`reset role`);
await db.exec(`update public.staff_members set status = 'suspended' where profile_id = '${MKT_A}'`);
await asUser(MKT_A);
const afterSuspend = (await q(`select count(*)::int as n from public.staff_leads`))[0].n;
check("a suspended member loses their leads too", afterSuspend === 0, `saw ${afterSuspend}`);

await db.exec(`reset role`);
await db.exec(`update public.staff_members set status = 'active' where profile_id = '${MKT_A}'`);

/* Admin */
await db.exec(`update public.profiles set role = 'admin' where id = '${OPS_C}'`);
await asUser(OPS_C);
const adminSees = (await q(`select count(*)::int as n from public.staff_leads`))[0].n;
check("an admin sees everything", adminSees === 1, `saw ${adminSees}`);

await db.exec(`reset role`);

console.log("\nrollback:");
await step("phase107 rollback", `
  drop trigger if exists staff_leads_touch on public.staff_leads;
  drop function if exists public.touch_staff_lead();
  drop table if exists public.staff_activities;
  drop table if exists public.staff_leads;
  drop function if exists public.my_staff_id();
`);

console.log(failed ? "\nFAILED" : "\nall checks passed");
process.exit(failed ? 1 : 0);
