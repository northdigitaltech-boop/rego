/* ============================================================
 * phase114 — expedition_bookings
 *
 * WHAT IS MISSING TODAY
 *   Every other category Rego lists has a bookings table:
 *   bookings, homestay_bookings, hostel_bookings, tour_bookings,
 *   transport_bookings, guide_bookings, media_bookings,
 *   restaurant_bookings, activity_bookings, coworking_bookings.
 *   Expeditions has none. "Request quote" on an expedition card is
 *   a label with nothing behind it — the card shows it whenever no
 *   price is set, and clicking through leads to a profile with no
 *   way to ask for anything.
 *
 *   So this is the eleventh table in an established pattern, not a
 *   new system. It is deliberately shaped like activity_bookings
 *   (phase39) down to the policy names, because the traveller
 *   dashboard, the cancellation route and the admin analytics all
 *   already know how to read a table of that shape.
 *
 * WHY ONE TABLE FOR THREE THINGS
 *   A traveller can want a company, an individual professional, or
 *   one of a company's packages. Those are three tables, but from
 *   the traveller's side it is one act: asking somebody to quote.
 *   Three tables would mean three dashboards, three queries in the
 *   traveller's list and three places to forget. So the subject is
 *   recorded as a kind plus an id, and exactly one of the three id
 *   columns is set — enforced by a CHECK, not by hoping.
 *
 * WHY A QUOTE AND NOT A PRICE
 *   An expedition is quoted after a conversation about the peak,
 *   the season, the permit and the team. There is no nightly rate
 *   to multiply. So this records the ASK — dates, peak, group size
 *   — and the money is agreed off-platform, as it already is for
 *   every other category: Rego does not process payments.
 *
 * NOT INCLUDED
 *   No automatic refund logic, for the same reason. Cancellation
 *   columns are here so the existing cancel route works on this
 *   table too, and nothing more.
 *
 * ROLLBACK: at the bottom. It drops a table that will hold real
 * customer enquiries — read the note before running it.
 * ============================================================ */

do $$
begin
  if to_regclass('public.expedition_companies') is null then
    raise exception 'public.expedition_companies is missing — run phase52-expeditions.sql first.';
  end if;
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'public.is_admin() is missing — run phase29-auth-profiles.sql first.';
  end if;
end $$;


create table if not exists public.expedition_bookings (
  id               uuid primary key default gen_random_uuid(),

  /* WHO IS BEING ASKED.
     Exactly one of the three id columns, matched to subject_kind by the
     CHECK below. on delete set null rather than cascade: if a company
     leaves Rego, the enquiry a traveller sent is still a thing that
     happened, and subject_title keeps it readable. */
  subject_kind     text not null,          -- company | professional | package
  company_id       uuid references public.expedition_companies(id) on delete set null,
  pro_id           uuid references public.expedition_professionals(id) on delete set null,
  package_id       uuid,                   -- expedition_packages, see the FK block below
  subject_title    text,                   -- human-readable, survives deletion

  /* Routed to the provider by email, the same way every other booking
     table in this schema does it. */
  owner_email      text,

  customer_email   text not null,
  customer_name    text,
  customer_phone   text,

  /* WHAT IS BEING ASKED FOR.
     All optional except the group size: somebody enquiring in January
     about "a 8000er, sometime in summer" is a real enquiry and should not
     be blocked by a form demanding an exact date. */
  peak             text,
  route            text,
  start_date       date,
  end_date         date,
  days             int,
  people           int not null default 1,
  experience_level text,
  notes            text,

  status           text not null default 'pending', -- pending | accepted | rejected | completed | cancelled

  /* The phase93 columns, created here rather than added later, so the
     existing cancel route works on this table from the first row. */
  cancelled_by        text,
  cancelled_at        timestamptz,
  cancellation_reason text,
  cancellation_note   text,
  previous_status     text,

  created_at       timestamptz not null default now(),

  constraint expedition_bookings_kind_known
    check (subject_kind in ('company', 'professional', 'package')),

  /* Exactly one subject. A row claiming to be about a company with only a
     pro_id set is not a row anything can render. */
  constraint expedition_bookings_one_subject check (
    (subject_kind = 'company'      and company_id is not null and pro_id is null and package_id is null)
    or (subject_kind = 'professional' and pro_id is not null and company_id is null and package_id is null)
    or (subject_kind = 'package'      and package_id is not null and pro_id is null)
  ),

  constraint expedition_bookings_people_sane check (people >= 1 and people <= 60),
  constraint expedition_bookings_days_sane   check (days is null or (days >= 1 and days <= 365)),
  constraint expedition_bookings_dates_order check (
    start_date is null or end_date is null or end_date >= start_date
  )
);

/* expedition_packages arrived in phase56, which not every deployment has
   run. Added conditionally so a missing table skips the constraint rather
   than aborting the migration. */
do $$
begin
  if to_regclass('public.expedition_packages') is not null
     and not exists (
       select 1 from pg_constraint where conname = 'expedition_bookings_package_fk'
     )
  then
    alter table public.expedition_bookings
      add constraint expedition_bookings_package_fk
      foreign key (package_id) references public.expedition_packages(id) on delete set null;
  end if;
end $$;

create index if not exists expedition_bk_company_idx  on public.expedition_bookings (company_id);
create index if not exists expedition_bk_pro_idx      on public.expedition_bookings (pro_id);
create index if not exists expedition_bk_package_idx  on public.expedition_bookings (package_id);
create index if not exists expedition_bk_owner_idx    on public.expedition_bookings (owner_email);
create index if not exists expedition_bk_customer_idx on public.expedition_bookings (customer_email);


/* ============================================================
 * RLS — the phase39 shape, verbatim in effect.
 *
 * A booking is readable by the traveller who sent it, the provider
 * it was sent to, and an admin. Nobody else: this row carries a
 * customer's name, email and phone number.
 *
 * Insert is checked against auth.email() so a signed-in person
 * cannot file an enquiry in somebody else's name.
 * ============================================================ */
alter table public.expedition_bookings enable row level security;

drop policy if exists expbk_read   on public.expedition_bookings;
drop policy if exists expbk_insert on public.expedition_bookings;
drop policy if exists expbk_update on public.expedition_bookings;
drop policy if exists expbk_delete on public.expedition_bookings;

create policy expbk_read on public.expedition_bookings for select
  using (
    customer_email = auth.email()
    or owner_email = auth.email()
    or public.is_admin()
  );

create policy expbk_insert on public.expedition_bookings for insert
  with check (customer_email = auth.email() or public.is_admin());

create policy expbk_update on public.expedition_bookings for update
  using (
    customer_email = auth.email()
    or owner_email = auth.email()
    or public.is_admin()
  )
  with check (
    customer_email = auth.email()
    or owner_email = auth.email()
    or public.is_admin()
  );

/* Only the provider or an admin may delete. A traveller cancels — which is
   an update that keeps the record — rather than erasing the fact that they
   asked. */
create policy expbk_delete on public.expedition_bookings for delete
  using (owner_email = auth.email() or public.is_admin());

grant select, insert, update on public.expedition_bookings to authenticated;
grant delete on public.expedition_bookings to authenticated;


select
  (select count(*) from public.expedition_bookings) as bookings,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'expedition_bookings') as policies,
  'Empty — nothing has been requested yet. Expect 4 policies.' as note;


/* ------------------------------------------------------------------
 * ROLLBACK
 *
 * This table holds real customer enquiries once the widget is live.
 * Check before dropping:
 *
 *   select count(*) from public.expedition_bookings;
 *
 * Then, only if that is zero or the rows are genuinely disposable:
 *
 *   -- drop table if exists public.expedition_bookings;
 *
 * Dropping the policies alone is not a rollback — with RLS on and no
 * policy, the table is readable by nobody and the screens go blank
 * without an error.
 * ------------------------------------------------------------------ */
