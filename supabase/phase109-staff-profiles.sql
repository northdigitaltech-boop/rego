/* ============================================================
 * phase109 — team phase 7: the person behind the employee code
 *
 * ADDITIVE AND IDEMPOTENT. One table. ROLLBACK at the bottom.
 *
 * ---------------------------------------------------------------------------
 * A SEPARATE TABLE, NOT MORE COLUMNS ON staff_members
 *
 * staff_members answers "what may this person do" — department, role, status,
 * scope — and every policy in phases 104 to 108 reads it. This answers "who
 * is this person", which is read far less often and is far more private.
 *
 * Keeping them apart means a colleague who may legitimately see a name and a
 * department does not need a policy carve-out to be kept away from a home
 * address. The privacy rule is the table boundary rather than a column list
 * somebody has to remember to update.
 *
 * ---------------------------------------------------------------------------
 * WHO CAN READ IT: THE PERSON, AND ADMINS. NOBODY ELSE.
 *
 * Not colleagues, not managers with view_leads, not anybody holding
 * `view_department_analytics`. A date of birth and a home address are not
 * team information, and §39 of the brief asks not to expose more than the
 * work needs. If a manager ever needs an emergency contact, an admin can
 * look — which is a decision somebody makes, not a door left open.
 *
 * ---------------------------------------------------------------------------
 * NO IDENTITY DOCUMENTS HERE
 *
 * No CNIC number, no scan, no degree certificate. Cloudinary delivery is
 * public to anyone holding the URL, which is fine for a hotel photograph and
 * not fine for a national identity card. Those need a private bucket with
 * its own policies, and that is a separate phase rather than a column added
 * quietly to this one.
 * ============================================================ */

do $$
begin
  if to_regclass('public.staff_members') is null then
    raise exception 'public.staff_members is missing — run phase104-staff-foundation.sql first.';
  end if;
end $$;


create table if not exists public.staff_profiles (
  /* One row per member, and the primary key says so — a second CV for the
     same person is not a thing, and a unique constraint added later never
     catches the rows that already broke it. */
  staff_id uuid primary key references public.staff_members(id) on delete cascade,

  /* Avatar is deliberately ABSENT. profiles.avatar already exists, the navbar
     already reads it, and a second picture is a second thing to be out of
     date. */

  headline text,          -- "Marketing executive, Skardu"
  bio       text,

  date_of_birth date,
  gender        text,

  /* Contact. phone lives on staff_members already; this is the rest. */
  personal_email text,
  address        text,
  city           text,

  emergency_contact_name  text,
  emergency_contact_phone text,
  emergency_contact_relation text,

  /* The CV proper. JSONB rather than four child tables: these are lists a
     person edits as a whole, never queried across people, and four tables
     would mean four sets of policies to keep in step for no benefit. Shape
     is validated in the application, not here — a check constraint on JSON
     structure fails at insert time with a message nobody can act on.

     education:  [{ qualification, institution, year, note }]
     experience: [{ title, organisation, from, to, note }]
     skills:     ["Copywriting", "Photography"]
     languages:  [{ name, level }] */
  education  jsonb not null default '[]'::jsonb,
  experience jsonb not null default '[]'::jsonb,
  skills     jsonb not null default '[]'::jsonb,
  languages  jsonb not null default '[]'::jsonb,

  updated_at timestamptz not null default now(),

  constraint staff_profiles_gender_known
    check (gender is null or gender in ('female','male','other','undisclosed')),
  /* Arrays, not objects. Cheap, and it stops a malformed write from making
     every reader defensive. */
  constraint staff_profiles_lists_are_arrays check (
    jsonb_typeof(education)  = 'array' and
    jsonb_typeof(experience) = 'array' and
    jsonb_typeof(skills)     = 'array' and
    jsonb_typeof(languages)  = 'array'
  ),
  /* Somebody typing today's year by accident should be stopped here rather
     than producing a colleague who is four years old. */
  constraint staff_profiles_dob_plausible check (
    date_of_birth is null
    or (date_of_birth > date '1920-01-01' and date_of_birth < current_date - interval '14 years')
  )
);


alter table public.staff_profiles enable row level security;

drop policy if exists staff_profiles_own on public.staff_profiles;
create policy staff_profiles_own on public.staff_profiles
  for all
  using (staff_id = public.my_staff_id())
  with check (staff_id = public.my_staff_id());

drop policy if exists staff_profiles_admin on public.staff_profiles;
create policy staff_profiles_admin on public.staff_profiles
  for all using (public.is_admin()) with check (public.is_admin());

/* Deliberately no third policy. There is no permission that opens somebody
   else's date of birth, and none is added here — a permission that exists
   is a permission that gets granted. */


create or replace function public.touch_staff_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists staff_profiles_touch on public.staff_profiles;
create trigger staff_profiles_touch
  before update on public.staff_profiles
  for each row execute function public.touch_staff_profile();


select
  (select count(*) from public.staff_profiles) as profiles,
  'Empty on purpose — each person fills their own in.' as note;


/* ------------------------------------------------------------------
 * ROLLBACK. This one holds real personal data; check before dropping:
 *   select count(*) from public.staff_profiles;
 * ------------------------------------------------------------------ */
-- drop trigger if exists staff_profiles_touch on public.staff_profiles;
-- drop function if exists public.touch_staff_profile();
-- drop table if exists public.staff_profiles;
