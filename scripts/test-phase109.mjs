/* phase104 + 106 + 107 + 109, then the rollback.

   What this file is really checking: that a colleague cannot read somebody
   else's date of birth or home address. Everything else about a CV is
   ordinary; that part is the reason the table is separate.
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
    id uuid primary key, email text, full_name text, avatar text,
    role text default 'customer');

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
const tryIt = async (sql) => {
  try {
    await db.exec(sql);
    return null;
  } catch (e) {
    return e.message;
  }
};
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
await step("phase109", read("supabase/phase109-staff-profiles.sql"));

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const ADMIN = "33333333-3333-3333-3333-333333333333";

await db.exec(`
  insert into public.profiles (id, email, role) values
    ('${A}','a@example.com','customer'),
    ('${B}','b@example.com','customer'),
    ('${ADMIN}','admin@example.com','admin');
  insert into public._whoami (id) values ('${A}');
`);

const mkt = (await q(`select id from public.staff_departments where slug='marketing'`))[0].id;
const role = (await q(`select id from public.staff_roles where department_id='${mkt}' limit 1`))[0].id;
const add = async (p) => {
  const code = (await q(`select public.next_employee_code('${mkt}') as c`))[0].c;
  await db.exec(`insert into public.staff_members
    (profile_id, employee_code, referral_code, department_id, role_id)
    values ('${p}','${code}','${code}','${mkt}','${role}')`);
};
await add(A);
await add(B);
const aStaff = (await q(`select id from public.staff_members where profile_id='${A}'`))[0].id;

await db.exec(`
  alter table public.staff_profiles force row level security;
  grant usage on schema public to authenticated;
  grant select, insert, update, delete on public.staff_profiles to authenticated;
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

console.log("\npolicies:");

await asUser(A);
check(
  "a member can write their own CV",
  (await tryIt(`
    insert into public.staff_profiles (staff_id, headline, date_of_birth, address, skills)
    values ('${aStaff}', 'Marketing executive, Skardu', date '1995-04-11',
            '12 Airport Road, Skardu', '["Copywriting","Photography"]'::jsonb)`)) === null
);

check(
  "they cannot write one for somebody else",
  (await tryIt(`
    insert into public.staff_profiles (staff_id, headline)
    values ((select id from public.staff_members where profile_id='${B}'), 'Not mine')`)) !== null
);

check("they can read their own", (await q(`select count(*)::int as n from public.staff_profiles`))[0].n === 1);

/* THE ONE THAT MATTERS. */
await asUser(B);
const colleagueSees = (await q(`select count(*)::int as n from public.staff_profiles`))[0].n;
check("a COLLEAGUE sees nothing at all", colleagueSees === 0, `saw ${colleagueSees}`);

await asUser(ADMIN);
check(
  "an admin can read it",
  (await q(`select count(*)::int as n from public.staff_profiles`))[0].n === 1
);

/* Constraints */
await asUser(A);
check(
  "a date of birth in the future is refused",
  (await tryIt(`update public.staff_profiles set date_of_birth = current_date where staff_id='${aStaff}'`)) !== null
);
check(
  "an object where a list belongs is refused",
  (await tryIt(`update public.staff_profiles set skills = '{"a":1}'::jsonb where staff_id='${aStaff}'`)) !== null
);
check(
  "a real list is accepted",
  (await tryIt(`update public.staff_profiles set languages = '[{"name":"Urdu","level":"native"}]'::jsonb where staff_id='${aStaff}'`)) === null
);

const stamped = (await q(`select updated_at from public.staff_profiles where staff_id='${aStaff}'`))[0];
check("updated_at is stamped by the trigger", stamped.updated_at !== null);

/* Suspension: my_staff_id() returns null, so their own row closes to them
   too. Worth asserting, because it is a consequence rather than a decision
   written in this file. */
await db.exec(`reset role`);
await db.exec(`update public.staff_members set status='suspended' where profile_id='${A}'`);
await asUser(A);
check(
  "a suspended member cannot reach their own CV either",
  (await q(`select count(*)::int as n from public.staff_profiles`))[0].n === 0
);

await db.exec(`reset role`);

console.log("\nrollback:");
await step("phase109 rollback", `
  drop trigger if exists staff_profiles_touch on public.staff_profiles;
  drop function if exists public.touch_staff_profile();
  drop table if exists public.staff_profiles;
`);

console.log(failed ? "\nFAILED" : "\nall checks passed");
process.exit(failed ? 1 : 0);
