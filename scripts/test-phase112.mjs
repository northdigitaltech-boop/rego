/* phase104 + 107 + 112, then the rollback.

   The two claims that matter:
     1. A colleague cannot read somebody else's thread.
     2. A member cannot post a message that looks like it came from Rego,
        and cannot rewrite one that did.
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
    language sql stable security definer as $fn$ select id from public._whoami limit 1 $fn$;

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
await step("phase107", read("supabase/phase107-staff-leads.sql"));
await step("phase112", read("supabase/phase112-staff-messages.sql"));

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const ADMIN = "33333333-3333-3333-3333-333333333333";

await db.exec(`
  insert into public.profiles (id, email, full_name, role) values
    ('${A}','a@example.com','Zuneera','customer'),
    ('${B}','b@example.com','Ali','customer'),
    ('${ADMIN}','admin@example.com','Rego','admin');
  insert into public._whoami (id) values ('${A}');
`);

const mkt = (await q(`select id from public.staff_departments where slug='marketing'`))[0].id;
const roleId = (await q(`select id from public.staff_roles where department_id='${mkt}' limit 1`))[0].id;
const add = async (p) => {
  const code = (await q(`select public.next_employee_code('${mkt}') as c`))[0].c;
  await db.exec(`insert into public.staff_members
    (profile_id, employee_code, referral_code, department_id, role_id)
    values ('${p}','${code}','${code}','${mkt}','${roleId}')`);
};
await add(A);
await add(B);
const aStaff = (await q(`select id from public.staff_members where profile_id='${A}'`))[0].id;

await db.exec(`
  alter table public.staff_messages force row level security;
  grant usage on schema public to authenticated;
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
const allRows = async () => {
  await db.exec(`reset role`);
  return q(`select id, body, from_admin, read_at from public.staff_messages order by created_at`);
};

console.log("\nsending:");

/* Admin writes first, the way it happens. */
await asUser(ADMIN);
check(
  "an admin can write into a member's thread",
  (await tryIt(`insert into public.staff_messages (staff_id, sender_id, sender_name, from_admin, body)
                values ('${aStaff}', '${ADMIN}', 'Rego', true, 'Please add twenty Skardu hotels this week.')`)) === null
);

await asUser(A);
check(
  "the member can reply",
  (await tryIt(`insert into public.staff_messages (staff_id, sender_id, sender_name, from_admin, body)
                values ('${aStaff}', '${A}', 'Zuneera', false, 'On it — fourteen done.')`)) === null
);

/* THE ONE THAT MATTERS MOST. */
await asUser(A);
await tryIt(`insert into public.staff_messages (staff_id, sender_id, sender_name, from_admin, body)
             values ('${aStaff}', '${A}', 'Rego', true, 'Approved by head office')`);
check(
  "a member CANNOT post a message that looks like it came from Rego",
  (await allRows()).filter((r) => r.from_admin).length === 1,
  "a forged admin message got in"
);

await asUser(A);
await tryIt(`insert into public.staff_messages (staff_id, sender_id, sender_name, from_admin, body)
             select id, '${A}', 'Zuneera', false, 'Not my thread'
               from public.staff_members where profile_id='${B}'`);
check(
  "and cannot write into a colleague's thread",
  (await allRows()).length === 2
);

console.log("\nreading:");

await asUser(B);
check(
  "a colleague sees nothing of it",
  (await q(`select count(*)::int as n from public.staff_messages`))[0].n === 0
);

await asUser(A);
check(
  "the member sees their own thread",
  (await q(`select count(*)::int as n from public.staff_messages`))[0].n === 2
);

await asUser(ADMIN);
check(
  "an admin sees it",
  (await q(`select count(*)::int as n from public.staff_messages`))[0].n === 2
);

console.log("\nafter it is sent:");

const adminMsg = (await allRows()).find((r) => r.from_admin);

await asUser(A);
check(
  "the member can mark an admin message read",
  (await tryIt(`update public.staff_messages set read_at = now() where id='${adminMsg.id}'`)) === null
);
check("and it stuck", (await allRows()).find((r) => r.id === adminMsg.id).read_at !== null);

await asUser(A);
await tryIt(`update public.staff_messages set body='Actually he said something else'
              where id='${adminMsg.id}'`);
check(
  "but CANNOT rewrite what was said",
  (await allRows()).find((r) => r.id === adminMsg.id).body
    === "Please add twenty Skardu hotels this week.",
  "the body was edited"
);

await asUser(A);
await tryIt(`delete from public.staff_messages`);
check("and cannot delete the thread", (await allRows()).length === 2);

/* Suspension: my_staff_id() returns null, so the thread closes. */
await db.exec(`reset role`);
await db.exec(`update public.staff_members set status='suspended' where profile_id='${A}'`);
await asUser(A);
check(
  "a suspended member loses access to their thread",
  (await q(`select count(*)::int as n from public.staff_messages`))[0].n === 0
);

await db.exec(`reset role`);

console.log("\nrollback:");
await step("phase112 rollback", `drop table if exists public.staff_messages;`);

console.log(failed ? "\nFAILED" : "\nall checks passed");
process.exit(failed ? 1 : 0);
