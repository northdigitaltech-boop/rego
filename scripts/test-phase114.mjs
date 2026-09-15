/* phase114, then the rollback.

   NOT YET RUN. The sandbox lost access to the drive before this could be
   executed, so treat every claim below as unverified until it prints.
   Run it with:

     cd /tmp/pgtest && SQL_DIR=<repo> node test-phase114.mjs

   The claims, in order of how much they would cost if wrong:

     1. A booking is readable ONLY by the traveller who sent it, the
        provider it was sent to, and an admin. This row carries a customer's
        name, email and phone; a wrong policy here is a data leak.
     2. A signed-in person cannot file an enquiry in somebody else's name.
     3. A row must name exactly one subject — company, professional or
        package. A row claiming one kind while carrying another's id is
        refused by the CHECK, not by the UI.
     4. A traveller cannot delete the record of having asked.

   ON ASSERTING: with RLS, a select that matches no policy returns zero rows
   and raises nothing, and an update that matches none affects zero rows
   silently. Every check below reads data back and counts it. Earlier phases
   logged false passes by testing for the absence of an exception.
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

  /* The two phase52 tables, reduced to what phase114 references. */
  create table public.expedition_companies (
    id uuid primary key default gen_random_uuid(),
    owner_email text, name text not null, status text default 'approved');
  create table public.expedition_professionals (
    id uuid primary key default gen_random_uuid(),
    owner_email text, full_name text not null, status text default 'approved');
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
await step("phase114", read("supabase/phase114-expedition-bookings.sql"));

const TRAVELLER = "11111111-1111-1111-1111-111111111111";
const OWNER     = "22222222-2222-2222-2222-222222222222";
const STRANGER  = "33333333-3333-3333-3333-333333333333";
const ADMIN     = "44444444-4444-4444-4444-444444444444";
const CO        = "55555555-5555-5555-5555-555555555555";

await db.exec(`
  insert into public.profiles (id, email, role) values
    ('${TRAVELLER}','traveller@example.com','customer'),
    ('${OWNER}','owner@example.com','partner'),
    ('${STRANGER}','stranger@example.com','customer'),
    ('${ADMIN}','admin@example.com','admin');
  insert into public._whoami (id, email) values ('${TRAVELLER}','traveller@example.com');

  insert into public.expedition_companies (id, owner_email, name)
    values ('${CO}','owner@example.com','K2 Trekking');

  insert into public.expedition_bookings
    (subject_kind, company_id, subject_title, owner_email,
     customer_email, customer_name, customer_phone, peak, people)
  values ('company','${CO}','K2 Trekking','owner@example.com',
          'traveller@example.com','A Traveller','+92300','K2', 4);

  alter table public.expedition_bookings force row level security;
  grant usage on schema public to authenticated;
`);

const asUser = async (email, id) => {
  await db.exec(`reset role`);
  await db.exec(`update public._whoami set id='${id}', email='${email}'`);
  await db.exec(`set role authenticated`);
};
const visible = async () =>
  (await q(`select count(*)::int as n from public.expedition_bookings`))[0].n;

console.log("\nwho can see a customer's name, email and phone:");

await asUser("traveller@example.com", TRAVELLER);
check("the traveller who sent it", await visible() === 1);

await asUser("owner@example.com", OWNER);
check("the provider it was sent to", await visible() === 1);

await asUser("admin@example.com", ADMIN);
check("an admin", await visible() === 1);

await asUser("stranger@example.com", STRANGER);
check("NOT another signed-in traveller", await visible() === 0,
      "a customer's phone number is readable by anyone with an account");

console.log("\nfiling an enquiry:");

await asUser("stranger@example.com", STRANGER);
await tryIt(`insert into public.expedition_bookings
  (subject_kind, company_id, owner_email, customer_email, people)
  values ('company','${CO}','owner@example.com','traveller@example.com', 2)`);
await db.exec(`reset role`);
check(
  "cannot be filed in somebody else's name",
  (await q(`select count(*)::int as n from public.expedition_bookings
             where customer_email='traveller@example.com'`))[0].n === 1,
  "a second row was created in the traveller's name"
);

await asUser("stranger@example.com", STRANGER);
check(
  "can be filed in your own name",
  (await tryIt(`insert into public.expedition_bookings
    (subject_kind, company_id, owner_email, customer_email, people)
    values ('company','${CO}','owner@example.com','stranger@example.com', 2)`)) === null
);

console.log("\nthe subject:");
await db.exec(`reset role`);

check(
  "a company booking carrying a pro_id is refused",
  (await tryIt(`insert into public.expedition_bookings
    (subject_kind, company_id, pro_id, customer_email)
    values ('company','${CO}','${CO}','x@example.com')`)) !== null
);
check(
  "a booking naming no subject at all is refused",
  (await tryIt(`insert into public.expedition_bookings
    (subject_kind, customer_email) values ('company','x@example.com')`)) !== null
);
check(
  "an unknown kind is refused",
  (await tryIt(`insert into public.expedition_bookings
    (subject_kind, company_id, customer_email)
    values ('helicopter','${CO}','x@example.com')`)) !== null
);
check(
  "an end date before the start date is refused",
  (await tryIt(`insert into public.expedition_bookings
    (subject_kind, company_id, customer_email, start_date, end_date)
    values ('company','${CO}','x@example.com','2026-07-10','2026-07-01')`)) !== null
);

console.log("\ndeleting:");
const before = (await q(`select count(*)::int as n from public.expedition_bookings`))[0].n;
await asUser("traveller@example.com", TRAVELLER);
await tryIt(`delete from public.expedition_bookings`);
await db.exec(`reset role`);
check(
  "a traveller cannot erase the fact that they asked",
  (await q(`select count(*)::int as n from public.expedition_bookings`))[0].n === before
);

console.log("\ncancelling keeps the record:");
await asUser("traveller@example.com", TRAVELLER);
await tryIt(`update public.expedition_bookings
             set status='cancelled', previous_status='pending',
                 cancelled_by='traveller@example.com', cancelled_at=now()
             where customer_email='traveller@example.com'`);
await db.exec(`reset role`);
const row = (await q(`select status, cancelled_by from public.expedition_bookings
                       where customer_email='traveller@example.com'`))[0];
check("the phase93 columns are writable by the traveller",
      row.status === "cancelled" && row.cancelled_by === "traveller@example.com");

console.log("\nrollback:");
await step("drops the table", `drop table if exists public.expedition_bookings`);
check("and it is gone",
      (await q(`select to_regclass('public.expedition_bookings') as t`))[0].t === null);

console.log(failed ? "\nFAILED" : "\nall good");
process.exit(failed ? 1 : 0);
