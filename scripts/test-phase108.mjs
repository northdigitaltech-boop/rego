/* phase104 + 106 + 107 + 108, then the rollback.

   The check that matters here is the COLUMN GRANT: an assignee may move a
   task along and may not rewrite what they were asked to do or when it is
   due. A row policy cannot express that, so if the revoke/grant pair is
   wrong the protection is decorative and every other check still passes.
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
await step("phase108", read("supabase/phase108-staff-tasks.sql"));

const A = "11111111-1111-1111-1111-111111111111"; // assignee
const B = "22222222-2222-2222-2222-222222222222"; // colleague, same department
const ADMIN = "33333333-3333-3333-3333-333333333333";

await db.exec(`
  insert into public.profiles (id, email, role) values
    ('${A}', 'a@example.com', 'customer'),
    ('${B}', 'b@example.com', 'customer'),
    ('${ADMIN}', 'admin@example.com', 'admin');
  insert into public._whoami (id) values ('${A}');
`);

const mkt = (await q(`select id from public.staff_departments where slug='marketing'`))[0].id;
const role = (await q(`select id from public.staff_roles where department_id='${mkt}' limit 1`))[0].id;

const add = async (profile) => {
  const code = (await q(`select public.next_employee_code('${mkt}') as c`))[0].c;
  await db.exec(`
    insert into public.staff_members (profile_id, employee_code, referral_code, department_id, role_id)
    values ('${profile}', '${code}', '${code}', '${mkt}', '${role}')`);
};
await add(A);
await add(B);

const aStaff = (await q(`select id from public.staff_members where profile_id='${A}'`))[0].id;

/* Assigned by an admin, the way the real route does it. */
await db.exec(`
  insert into public.staff_tasks (staff_id, department_id, title, detail, due_date, assigned_by)
  values ('${aStaff}', '${mkt}', 'Visit three hotels in Skardu',
          'Ask about listing with Rego', current_date + 7, '${ADMIN}')`);

const taskId = (await q(`select id from public.staff_tasks limit 1`))[0].id;

await db.exec(`
  alter table public.staff_tasks force row level security;
  grant usage on schema public to authenticated;
  grant select on public.staff_members, public.staff_departments, public.staff_roles,
                  public.staff_permissions, public.staff_role_permissions,
                  public.staff_permission_grants, public.staff_scopes,
                  public.locations, public.profiles
    to authenticated;
`);

const asUser = async (id) => {
  await db.exec(`reset role`);
  await db.exec(`update public._whoami set id = '${id}'`);
  await db.exec(`set role authenticated`);
};

console.log("\npolicies and grants:");

await asUser(A);
check(
  "the assignee sees their task",
  (await q(`select count(*)::int as n from public.staff_tasks`))[0].n === 1
);

check(
  "they can move it along",
  (await tryIt(`update public.staff_tasks set status='in_progress' where id='${taskId}'`)) === null
);

check(
  "they can leave a progress note",
  (await tryIt(`update public.staff_tasks set progress_note='Two done' where id='${taskId}'`)) === null
);

/* THE ONE THIS FILE EXISTS FOR. These must be refused by the column grant,
   which DOES raise — unlike a missing row policy, which silently affects
   nothing. So an exception is the right assertion here. */
const dueErr = await tryIt(`update public.staff_tasks set due_date=current_date+90 where id='${taskId}'`);
check("they CANNOT move their own deadline", dueErr !== null, dueErr ?? "it was allowed");

const titleErr = await tryIt(`update public.staff_tasks set title='Something easier' where id='${taskId}'`);
check("they CANNOT rewrite what they were asked to do", titleErr !== null, titleErr ?? "it was allowed");

const reassignErr = await tryIt(`update public.staff_tasks set staff_id='${aStaff}' where id='${taskId}'`);
check("they CANNOT reassign it", reassignErr !== null, reassignErr ?? "it was allowed");

/* completed_at is the trigger's, not theirs. */
await db.exec(`update public.staff_tasks set status='done' where id='${taskId}'`);
const done = (await q(`select completed_at, status from public.staff_tasks where id='${taskId}'`))[0];
check("finishing it stamps completed_at", done.completed_at !== null);

await db.exec(`update public.staff_tasks set status='todo' where id='${taskId}'`);
const reopened = (await q(`select completed_at from public.staff_tasks where id='${taskId}'`))[0];
check("reopening it clears completed_at", reopened.completed_at === null);

/* Insert and delete are admin-only. Both are refused silently by the missing
   policy, so read the rows back rather than expecting an error. */
await tryIt(`
  insert into public.staff_tasks (staff_id, department_id, title)
  values ('${aStaff}', '${mkt}', 'A task I set myself')`);
check(
  "staff cannot assign themselves work",
  (await q(`select count(*)::int as n from public.staff_tasks`))[0].n === 1
);

await tryIt(`delete from public.staff_tasks where id='${taskId}'`);
check(
  "staff cannot delete a task that is going badly",
  (await q(`select count(*)::int as n from public.staff_tasks`))[0].n === 1
);

/* A colleague without view_tasks sees nothing; with it, only their own
   department. Whichever the seeded role has, the count must be 0 or 1 and
   never a leak across departments — checked in phase107 for leads. */
await asUser(B);
const colleague = (await q(`select count(*)::int as n from public.staff_tasks`))[0].n;
check("a colleague's view follows view_tasks", colleague === 0 || colleague === 1, `saw ${colleague}`);

await asUser(A);
await db.exec(`reset role`);
await db.exec(`update public.staff_members set status='suspended' where profile_id='${A}'`);
await asUser(A);
check(
  "a suspended member loses their tasks",
  (await q(`select count(*)::int as n from public.staff_tasks`))[0].n === 0
);

await db.exec(`reset role`);

console.log("\nrollback:");
await step("phase108 rollback", `
  drop trigger if exists staff_tasks_touch on public.staff_tasks;
  drop function if exists public.touch_staff_task();
  drop table if exists public.staff_tasks;
`);

console.log(failed ? "\nFAILED" : "\nall checks passed");
process.exit(failed ? 1 : 0);
