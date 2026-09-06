/* Runs phase104 + phase106 (and their rollbacks) against an in-memory
   Postgres, so a syntax error or a bad column name is found here rather
   than in the Supabase editor.

   Not part of the build. Run with:
     node scripts/test-phase106.mjs
   from a directory where @electric-sql/pglite is installed.

   IT RUNS EVERY FILE TO THE END. An earlier harness sliced files at a
   comment marker and therefore reported success while never executing the
   statement that was broken. */

import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SQL_DIR = process.env.SQL_DIR || ".";
const read = (f) => readFileSync(join(SQL_DIR, f), "utf8");

const db = await new PGlite();

/* Stubs for what Supabase provides and these migrations assume. */
await db.exec(`
  create role anon;
  create role authenticated;
  create role service_role;

  create schema if not exists auth;
  create table auth.users (id uuid primary key, email text);

  -- Swapped per test to impersonate a signed-in user.
  create table public._whoami (id uuid);
  create or replace function auth.uid() returns uuid
    language sql stable as $fn$ select id from public._whoami limit 1 $fn$;

  create table public.profiles (
    id uuid primary key,
    email text,
    full_name text,
    role text default 'customer'
  );

  create or replace function public.is_admin() returns boolean
    language sql stable as $fn$
      select exists (select 1 from public.profiles
                      where id = auth.uid() and role = 'admin')
    $fn$;

  create table public.markets (
    id uuid primary key default gen_random_uuid(),
    slug text unique, name text
  );

  create table public.locations (
    id uuid primary key default gen_random_uuid(),
    market_id uuid references public.markets(id),
    parent_id uuid references public.locations(id),
    location_type text not null,
    name text not null,
    slug text not null,
    ancestors uuid[] not null default '{}'
  );
`);

const step = async (label, sql) => {
  try {
    await db.exec(sql);
    console.log(`  ok   ${label}`);
  } catch (e) {
    console.log(`  FAIL ${label}\n       ${e.message}`);
    process.exitCode = 1;
    throw e;
  }
};

console.log("apply:");
await step("phase104", read("supabase/phase104-staff-foundation.sql"));
await step("phase106", read("supabase/phase106-staff-portal-profile.sql"));

/* ---- behaviour, not just syntax ---- */
console.log("\nbehaviour:");

const q = async (sql) => (await db.query(sql)).rows;

// A market, a division and a district under it.
await db.exec(`
  insert into public.markets (id, slug, name)
    values ('11111111-1111-1111-1111-111111111111', 'pk', 'Pakistan');
  insert into public.locations (id, market_id, location_type, name, slug, ancestors)
    values ('22222222-2222-2222-2222-222222222222',
            '11111111-1111-1111-1111-111111111111',
            'division', 'Baltistan Division', 'baltistan', '{}');
  insert into public.locations (id, market_id, parent_id, location_type, name, slug, ancestors)
    values ('33333333-3333-3333-3333-333333333333',
            '11111111-1111-1111-1111-111111111111',
            '22222222-2222-2222-2222-222222222222',
            'district', 'Skardu', 'skardu',
            '{22222222-2222-2222-2222-222222222222}');

  insert into public.profiles (id, email, full_name, role)
    values ('44444444-4444-4444-4444-444444444444', 'staff@example.com', 'A Person', 'customer');
  insert into public._whoami (id) values ('44444444-4444-4444-4444-444444444444');
`);

const [{ dept, role }] = await q(`
  select (select id from public.staff_departments where slug = 'marketing') as dept,
         (select id from public.staff_roles where department_id =
            (select id from public.staff_departments where slug = 'marketing')
          limit 1) as role`);

if (!dept || !role) {
  console.log("  FAIL phase104 did not seed a marketing department and role");
  process.exit(1);
}

const code = (await q(`select public.next_employee_code('${dept}') as c`))[0].c;
console.log(`  ok   employee code generated: ${code}`);

await db.exec(`
  insert into public.staff_members
    (profile_id, employee_code, referral_code, department_id, role_id, job_title)
  values ('44444444-4444-4444-4444-444444444444', '${code}', '${code}',
          '${dept}', '${role}', 'Digital Marketing Manager');
`);

const me = (await q(`select public.my_staff_profile() as p`))[0].p;

const check = (label, cond) => {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}`);
  if (!cond) process.exitCode = 1;
};

check("returns the caller's record", me && me.employee_code === code);
check("includes the department name", me?.department?.name?.length > 0);
check("includes the role name", me?.role?.name?.length > 0);
check("permissions is an array", Array.isArray(me?.permissions));
check("the role carries at least one permission", (me?.permissions?.length ?? 0) > 0);
check("scopes is empty before any is set", Array.isArray(me?.scopes) && me.scopes.length === 0);

/* A revoked permission must disappear from the list, and a granted one
   must appear — the whole reason this is computed in the database. */
const first = me.permissions[0];
await db.exec(`
  insert into public.staff_permission_grants (staff_id, permission_id, granted)
  select m.id, p.id, false
    from public.staff_members m, public.staff_permissions p
   where m.employee_code = '${code}' and p.slug = '${first}';
`);
const afterRevoke = (await q(`select public.my_staff_profile() as p`))[0].p;
check(`revoking "${first}" removes it`, !afterRevoke.permissions.includes(first));

const extra = (await q(`
  select p.slug from public.staff_permissions p
   where not exists (select 1 from public.staff_role_permissions rp
                      where rp.role_id = '${role}' and rp.permission_id = p.id)
   limit 1`))[0]?.slug;
if (extra) {
  await db.exec(`
    insert into public.staff_permission_grants (staff_id, permission_id, granted)
    select m.id, p.id, true
      from public.staff_members m, public.staff_permissions p
     where m.employee_code = '${code}' and p.slug = '${extra}';
  `);
  const afterGrant = (await q(`select public.my_staff_profile() as p`))[0].p;
  check(`granting "${extra}" adds it`, afterGrant.permissions.includes(extra));
}

/* my_staff_profile and staff_can must agree. A disagreement is the exact
   failure this design exists to prevent. */
const current = (await q(`select public.my_staff_profile() as p`))[0].p;
const all = await q(`select slug from public.staff_permissions order by slug`);
let mismatch = null;
for (const { slug } of all) {
  const listed = current.permissions.includes(slug);
  const can = (await q(`select public.staff_can('${slug}') as v`))[0].v;
  if (listed !== can) { mismatch = `${slug}: listed=${listed} staff_can=${can}`; break; }
}
check(`agrees with staff_can() on all ${all.length} permissions`, mismatch === null);
if (mismatch) console.log(`       ${mismatch}`);

/* Scope: descendants. */
await db.exec(`
  insert into public.staff_scopes (staff_id, location_id, includes_descendants)
  select id, '22222222-2222-2222-2222-222222222222', true
    from public.staff_members where employee_code = '${code}';
`);
const scoped = (await q(`select public.my_staff_profile() as p`))[0].p;
check("scope appears with its location name", scoped.scopes[0]?.name === "Baltistan Division");

const perm = scoped.permissions[0];
const inDistrict = (await q(
  `select public.staff_can('${perm}', '33333333-3333-3333-3333-333333333333') as v`))[0].v;
check("a division scope reaches a district inside it", inDistrict === true);

/* Suspension. */
await db.exec(`update public.staff_members set status = 'suspended' where employee_code = '${code}'`);
const suspended = (await q(`select public.my_staff_profile() as p`))[0].p;
check("a suspended member gets null, like a stranger", suspended === null);
await db.exec(`update public.staff_members set status = 'active' where employee_code = '${code}'`);

/* Somebody who is not staff. */
await db.exec(`
  insert into public.profiles (id, email, role)
    values ('55555555-5555-5555-5555-555555555555', 'nobody@example.com', 'customer');
  update public._whoami set id = '55555555-5555-5555-5555-555555555555';
`);
check("a non-staff account gets null",
  (await q(`select public.my_staff_profile() as p`))[0].p === null);

await db.exec(`select public.touch_staff_seen()`);
check("touch_staff_seen leaves other people alone",
  (await q(`select last_seen_at from public.staff_members where employee_code = '${code}'`))[0]
    .last_seen_at === null);

await db.exec(`update public._whoami set id = '44444444-4444-4444-4444-444444444444'`);
await db.exec(`select public.touch_staff_seen()`);
check("touch_staff_seen updates the caller",
  (await q(`select last_seen_at from public.staff_members where employee_code = '${code}'`))[0]
    .last_seen_at !== null);

/* ---- rollback ---- */
console.log("\nrollback:");
await step("phase106 rollback", `
  drop function if exists public.touch_staff_seen();
  drop function if exists public.my_staff_profile();
`);

console.log(process.exitCode ? "\nFAILED" : "\nall checks passed");
