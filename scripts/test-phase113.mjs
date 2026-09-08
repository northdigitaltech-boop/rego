/* phase113, then the rollback.

   The claims, in order of how much they would cost if wrong:

     1. A staff member with view_locations can read a NON-PUBLIC market and
        a NON-PUBLIC location. This is the bug: they could not, so the
        screen was empty and there was nothing to add a destination under.
     2. The public still sees only public rows. If this broke, every
        unpublished area on Rego would appear on the website.
     3. A signed-in person who is NOT staff still sees only public rows.
     4. A suspended staff member loses it immediately.
     5. Read is not write — staff still cannot INSERT a location directly.
        (The API writes with the service-role key; that is the only path.)
     6. PART B: a logged-out visitor can still read a phase110 table. Before
        this file they could not — a policy with no TO clause is evaluated
        for `anon` too, and it calls a function `anon` may not execute, so
        the SELECT does not return false, it RAISES. Every public page
        reading one of those ~48 tables was returning an error.

   ON ASSERTING: with RLS, a select that matches no policy returns zero rows
   and raises nothing. So every check below reads data back and counts it.
   Three earlier phases logged false passes by testing for the absence of an
   exception. Do not reintroduce that.
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

  /* The phase72 shape, reduced to the columns the policies read. */
  create table public.markets (
    id uuid primary key default gen_random_uuid(),
    slug text unique, name text,
    is_active boolean not null default false,
    is_public boolean not null default false);

  create table public.locations (
    id uuid primary key default gen_random_uuid(),
    market_id uuid, parent_id uuid,
    location_type text not null, name text not null, slug text not null,
    ancestors uuid[] not null default '{}',
    is_active boolean, is_public boolean);

  create table public.location_service_settings (
    id uuid primary key default gen_random_uuid(),
    location_id uuid references public.locations(id), service_slug text);

  create table public.location_seo (
    id uuid primary key default gen_random_uuid(),
    location_id uuid references public.locations(id), seo_title text);

  create table public.location_translations (
    id uuid primary key default gen_random_uuid(),
    location_id uuid references public.locations(id), lang text, name text);

  alter table public.markets                   enable row level security;
  alter table public.locations                 enable row level security;
  alter table public.location_service_settings enable row level security;
  alter table public.location_seo              enable row level security;
  alter table public.location_translations     enable row level security;

  /* The phase72 policies, verbatim in effect. */
  create policy markets_public_read on public.markets
    for select using (is_public is true and is_active is true);
  create policy markets_admin_read on public.markets
    for select using (public.is_admin());
  create policy markets_admin_write on public.markets
    for all using (public.is_admin()) with check (public.is_admin());

  create policy locations_public_read on public.locations
    for select using (is_public is true and is_active is not false);
  create policy locations_admin_read on public.locations
    for select using (public.is_admin());
  create policy locations_admin_write on public.locations
    for all using (public.is_admin()) with check (public.is_admin());

  create policy lss_public_read on public.location_service_settings
    for select using (exists (select 1 from public.locations l
      where l.id = location_id and l.is_public is true and l.is_active is not false));
  create policy lss_admin_write on public.location_service_settings
    for all using (public.is_admin()) with check (public.is_admin());

  create policy location_seo_public_read on public.location_seo
    for select using (exists (select 1 from public.locations l
      where l.id = location_id and l.is_public is true and l.is_active is not false));
  create policy location_seo_admin_write on public.location_seo
    for all using (public.is_admin()) with check (public.is_admin());

  create policy location_translations_public_read on public.location_translations
    for select using (exists (select 1 from public.locations l
      where l.id = location_id and l.is_public is true and l.is_active is not false));
  create policy location_translations_admin_write on public.location_translations
    for all using (public.is_admin()) with check (public.is_admin());
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

/* A phase110 table, created BEFORE phase110 runs so it is not skipped.
   `events` is public-facing: a logged-out visitor reads it on the site. */
await db.exec(`
  create table public.events (
    id uuid primary key default gen_random_uuid(),
    title text, is_published boolean not null default true);
  insert into public.events (title, is_published) values ('Shandur Polo', true);
  alter table public.events enable row level security;
  alter table public.events force row level security;
  create policy events_public_read on public.events
    for select using (is_published is true);
  grant select on public.events to anon, authenticated;
`);

console.log("apply:");
await step("phase104", read("supabase/phase104-staff-foundation.sql"));
await step("phase110", read("supabase/phase110-module-permissions.sql"));

/* THE STATE BEFORE THE FIX. Asserted, not assumed — if phase110 is ever
   changed to scope its policies, this check should fail loudly and this
   part of phase113 can be deleted, rather than sitting here forever
   protecting against something that no longer happens. */
await db.exec(`reset role`);
await db.exec(`update public._whoami set id=null, email=null`);
await db.exec(`set role anon`);
let anonBroke = null;
try { await db.query(`select count(*) from public.events`); }
catch (e) { anonBroke = e.message; }
await db.exec(`reset role`);
console.log("\nbefore phase113 — a logged-out visitor reading a phase110 table:");
check(
  "the public site is broken by phase110's unscoped policy",
  anonBroke !== null && /permission denied for function/i.test(anonBroke),
  `expected a permission error, got: ${anonBroke ?? "no error at all"}`
);

console.log("\napply:");
await step("phase113", read("supabase/phase113-staff-location-read.sql"));

const STAFF    = "22222222-2222-2222-2222-222222222222";
const ADMIN    = "33333333-3333-3333-3333-333333333333";
const OUTSIDER = "99999999-9999-9999-9999-999999999999";

const MKT_HIDDEN = "44444444-4444-4444-4444-444444444444";
const MKT_LIVE   = "4a4a4a4a-4444-4444-4444-444444444444";
const LOC_HIDDEN = "55555555-5555-5555-5555-555555555555";
const LOC_LIVE   = "66666666-6666-6666-6666-666666666666";

await db.exec(`
  insert into public.profiles (id, email, role) values
    ('${STAFF}','staff@example.com','customer'),
    ('${ADMIN}','admin@example.com','admin'),
    ('${OUTSIDER}','someone@example.com','customer');
  insert into public._whoami (id, email) values ('${STAFF}','staff@example.com');

  /* Pakistan as phase72 actually seeds it: inactive and non-public. */
  insert into public.markets (id, slug, name, is_active, is_public) values
    ('${MKT_HIDDEN}','pakistan','Pakistan', false, false),
    ('${MKT_LIVE}',  'live',    'Live market', true, true);

  insert into public.locations (id, market_id, location_type, name, slug, is_active, is_public) values
    ('${LOC_HIDDEN}','${MKT_HIDDEN}','division','Baltistan','baltistan', null, null),
    ('${LOC_LIVE}',  '${MKT_LIVE}',  'district','Hunza','hunza', true, true);

  insert into public.location_service_settings (location_id, service_slug)
    values ('${LOC_HIDDEN}','hotels');
  insert into public.location_seo (location_id, seo_title)
    values ('${LOC_HIDDEN}','Baltistan');
  insert into public.location_translations (location_id, lang, name)
    values ('${LOC_HIDDEN}','ur','بلتستان');
`);

const mkt = (await q(`select id from public.staff_departments where slug='marketing'`))[0].id;
const roleId = (await q(`select id from public.staff_roles where department_id='${mkt}' limit 1`))[0].id;
const code = (await q(`select public.next_employee_code('${mkt}') as c`))[0].c;
await db.exec(`insert into public.staff_members
  (profile_id, employee_code, referral_code, department_id, role_id)
  values ('${STAFF}','${code}','${code}','${mkt}','${roleId}')`);

/* The seeded marketing role carries view_locations. Assert it rather than
   assume it — if that ever changes, this test should say so, not silently
   start testing nothing. */
const hasView = (await q(`
  select count(*)::int as n
    from public.staff_role_permissions rp
    join public.staff_permissions p on p.id = rp.permission_id
   where rp.role_id = '${roleId}' and p.slug = 'view_locations'`))[0].n;

await db.exec(`
  alter table public.markets                   force row level security;
  alter table public.locations                 force row level security;
  alter table public.location_service_settings force row level security;
  alter table public.location_seo              force row level security;
  alter table public.location_translations     force row level security;
  grant usage on schema public to authenticated, anon;
  grant select, insert, update, delete on public.markets, public.locations,
        public.location_service_settings, public.location_seo,
        public.location_translations to authenticated;
  grant select on public.markets, public.locations to anon;
  grant select on public.staff_members, public.staff_departments, public.staff_roles,
                  public.staff_permissions, public.staff_role_permissions,
                  public.staff_permission_grants, public.staff_scopes,
                  public.profiles to authenticated;
`);

const asUser = async (id, email, role = "authenticated") => {
  await db.exec(`reset role`);
  await db.exec(`update public._whoami set id='${id}', email='${email}'`);
  await db.exec(`set role ${role}`);
};
const countOf = async (table) =>
  (await q(`select count(*)::int as n from public.${table}`))[0].n;

console.log("\nthe marketing member:");
check("the seeded marketing role carries view_locations", hasView === 1,
      "the rest of this file would be testing nothing");

await asUser(STAFF, "staff@example.com");
check("sees the non-public Pakistan market", await countOf("markets") === 2,
      "this is the bug — an empty dropdown, so nothing to add a destination under");
check("sees the non-public Baltistan location", await countOf("locations") === 2);
check("sees its service settings",   await countOf("location_service_settings") === 1);
check("sees its SEO draft",          await countOf("location_seo") === 1);
check("sees its translation",        await countOf("location_translations") === 1);

/* Read is not write. The API holds the only write path. */
await asUser(STAFF, "staff@example.com");
await tryIt(`insert into public.locations (market_id, location_type, name, slug)
             values ('${MKT_HIDDEN}','district','Sneaky','sneaky')`);
await db.exec(`reset role`);
check(
  "still cannot insert a location directly",
  (await q(`select count(*)::int as n from public.locations where slug='sneaky'`))[0].n === 0,
  "reading the tree became permission to write to it"
);

console.log("\nthe public site:");
await asUser(OUTSIDER, "nobody@example.com", "anon");
check("still sees only the public market",   await countOf("markets") === 1);
check("still sees only the public location", await countOf("locations") === 1);

console.log("\na signed-in traveler who is not staff:");
await asUser(OUTSIDER, "someone@example.com");
check("sees only the public market",   await countOf("markets") === 1);
check("sees only the public location", await countOf("locations") === 1);

console.log("\nan admin:");
await asUser(ADMIN, "admin@example.com");
check("still sees everything", await countOf("markets") === 2 && await countOf("locations") === 2);

console.log("\nsuspension:");
await db.exec(`reset role`);
await db.exec(`update public.staff_members set status='suspended' where profile_id='${STAFF}'`);
await asUser(STAFF, "staff@example.com");
check("a suspended member drops back to the public rows",
      await countOf("markets") === 1 && await countOf("locations") === 1);
await db.exec(`reset role`);
await db.exec(`update public.staff_members set status='active' where profile_id='${STAFF}'`);

console.log("\npart B — the public site, on a phase110 table:");
await db.exec(`reset role`);
await db.exec(`update public._whoami set id=null, email=null`);
await db.exec(`set role anon`);
let anonNow = null, anonRows = -1;
try { anonRows = (await q(`select count(*)::int as n from public.events`))[0].n; }
catch (e) { anonNow = e.message; }
await db.exec(`reset role`);
check("a logged-out visitor can read events again", anonNow === null, anonNow ?? "");
check("and sees the published event", anonRows === 1);

check(
  "no staff policy is left aimed at PUBLIC",
  (await q(`select count(*)::int as n from pg_policies
             where schemaname='public'
               and (policyname like 'staff110\\_%' or policyname like 'staff111\\_%'
                    or policyname like 'staff113\\_%')
               and roles = '{public}'`))[0].n === 0
);

/* The repair must not have changed WHO may do WHAT. */
await asUser(STAFF, "staff@example.com");
check(
  "a staff member without manage_events still cannot write to events",
  (await tryIt(`insert into public.events (title) values ('Sneaky')`)) !== null ||
    (await q(`select count(*)::int as n from public.events where title='Sneaky'`))[0].n === 0
);
await db.exec(`reset role`);

/* Re-running must be a no-op, not a second round of ALTERs. */
await step("phase113 is idempotent", read("supabase/phase113-staff-location-read.sql"));

console.log("\nrollback:");
await db.exec(`reset role`);
await step("drops the five policies", `
  drop policy if exists staff113_markets_read               on public.markets;
  drop policy if exists staff113_locations_read             on public.locations;
  drop policy if exists staff113_lss_read                   on public.location_service_settings;
  drop policy if exists staff113_location_seo_read          on public.location_seo;
  drop policy if exists staff113_location_translations_read on public.location_translations;
`);
await asUser(STAFF, "staff@example.com");
check("staff are back to the public rows only",
      await countOf("markets") === 1 && await countOf("locations") === 1);
await asUser(ADMIN, "admin@example.com");
check("and the admin is untouched",
      await countOf("markets") === 2 && await countOf("locations") === 2);

await db.exec(`reset role`);
console.log(failed ? "\nFAILED" : "\nall good");
process.exit(failed ? 1 : 0);
