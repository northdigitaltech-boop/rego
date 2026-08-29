-- ============================================================================
-- Phase 93: let a traveller cancel a booking.
-- ============================================================================
--
-- ADDITIVE ONLY. Adds columns and one new table. Drops nothing, rewrites no
-- existing row, and changes no existing policy. Safe to re-run.
--
-- WHY IT TOUCHES TEN TABLES
--   REGO does not have a bookings table. It has ten — one per service kind —
--   each with its own columns and its own provider dashboard. A cancellation
--   has to work the same way in all of them, so the columns are added by
--   introspection rather than by a hand-written list of ALTER statements: a
--   table that is not in this database is skipped, not fatal.
--
-- WHAT IS RECORDED
--   previous_status is the point of this. A cancelled booking that only says
--   'cancelled' has lost the thing you most want to know six months later —
--   whether the provider had already accepted it. Keeping the status it was
--   cancelled FROM is what makes the audit trail worth having.
--
-- NO REFUND FIELDS
--   Deliberately. Rego does not process or hold payments, so a refund column
--   would be a place to record something Rego has no way to know or do.
--
-- ROLLBACK: at the bottom, and it is a real one.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- STEP 1 — columns on every booking table that exists here.
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'bookings', 'homestay_bookings', 'hostel_bookings', 'tour_bookings',
    'transport_bookings', 'guide_bookings', 'media_bookings',
    'restaurant_bookings', 'activity_bookings', 'coworking_bookings'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is null then
      continue;                       -- not in this database; not an error
    end if;

    /* Every one is nullable with no default. Existing rows stay exactly as
       they are — a booking made last year is not retroactively "not
       cancelled by anyone", it simply has nothing recorded, and the UI reads
       null as "this was never cancelled". */
    execute format('alter table public.%I add column if not exists cancelled_by text', t);
    execute format('alter table public.%I add column if not exists cancelled_at timestamptz', t);
    execute format('alter table public.%I add column if not exists cancellation_reason text', t);
    execute format('alter table public.%I add column if not exists cancellation_note text', t);
    execute format('alter table public.%I add column if not exists previous_status text', t);

    /* Providers filter their dashboard by status; this keeps that fast once
       cancelled rows accumulate. */
    execute format(
      'create index if not exists %I on public.%I (status)',
      t || '_status_idx', t);
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- STEP 2 — the audit trail.
--
-- Shaped like public.answer_audit_logs, which is the convention this codebase
-- already uses for "who changed what, when". booking_kind is stored alongside
-- booking_id because a booking id is only unique within its own table.
-- ----------------------------------------------------------------------------
create table if not exists public.booking_audit_logs (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null,
  booking_kind  text not null,          -- hotel | homestay | guide | ...
  actor_id      uuid,
  actor_email   text,
  actor_role    text,                   -- traveler | provider | admin
  -- cancelled | accepted | rejected | completed | reopened
  action        text not null,
  from_status   text,
  to_status     text,
  reason        text,
  note          text,
  created_at    timestamptz not null default now()
);

create index if not exists booking_audit_booking_idx
  on public.booking_audit_logs (booking_id);
create index if not exists booking_audit_created_idx
  on public.booking_audit_logs (created_at desc);
create index if not exists booking_audit_actor_idx
  on public.booking_audit_logs (actor_email);


-- ----------------------------------------------------------------------------
-- STEP 3 — who may read the audit trail.
--
-- Nobody writes to it through the anon key. Rows are inserted by
-- /api/booking/cancel using the service-role key, which bypasses RLS — so
-- there is no insert policy at all, and that is on purpose. A history that
-- the subject of the history can edit is not a history.
--
-- Reading is admin-only for now. A traveller already sees their own
-- cancellation on the booking itself, and a provider sees it on theirs;
-- neither needs the log, and opening it up would mean joining across ten
-- tables inside a policy expression to prove ownership.
-- ----------------------------------------------------------------------------
alter table public.booking_audit_logs enable row level security;

do $$
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception
      'public.is_admin() is missing — run phase29-auth-profiles.sql first. Stopping rather than creating an open policy on an audit log.';
  end if;

  drop policy if exists "bal_read" on public.booking_audit_logs;
  create policy "bal_read" on public.booking_audit_logs
    for select using (public.is_admin());
end $$;


-- ----------------------------------------------------------------------------
-- STEP 4 — verify.
-- ----------------------------------------------------------------------------
with expected(tbl) as (
  values ('bookings'),('homestay_bookings'),('hostel_bookings'),('tour_bookings'),
         ('transport_bookings'),('guide_bookings'),('media_bookings'),
         ('restaurant_bookings'),('activity_bookings'),('coworking_bookings')
)
select
  e.tbl as table_name,
  case when to_regclass('public.' || e.tbl) is null then 'not in this database'
       when (select count(*) from information_schema.columns c
              where c.table_schema = 'public' and c.table_name = e.tbl
                and c.column_name in ('cancelled_by','cancelled_at',
                     'cancellation_reason','cancellation_note','previous_status')) = 5
       then 'ready'
       else 'INCOMPLETE — some columns missing'
  end as status
from expected e
union all
select 'booking_audit_logs',
  case when to_regclass('public.booking_audit_logs') is null
       then 'MISSING' else 'ready' end
order by table_name;


-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- Drops the columns and the log. Any cancellation recorded in the meantime is
-- lost with them — which is the honest consequence, not a footnote. If
-- bookings have already been cancelled, export booking_audit_logs first.
--
-- do $$
-- declare t text;
-- begin
--   foreach t in array array[
--     'bookings','homestay_bookings','hostel_bookings','tour_bookings',
--     'transport_bookings','guide_bookings','media_bookings',
--     'restaurant_bookings','activity_bookings','coworking_bookings'
--   ] loop
--     if to_regclass('public.' || t) is null then continue; end if;
--     execute format('alter table public.%I drop column if exists cancelled_by', t);
--     execute format('alter table public.%I drop column if exists cancelled_at', t);
--     execute format('alter table public.%I drop column if exists cancellation_reason', t);
--     execute format('alter table public.%I drop column if exists cancellation_note', t);
--     execute format('alter table public.%I drop column if exists previous_status', t);
--   end loop;
-- end $$;
-- drop table if exists public.booking_audit_logs;
--
-- The status index is left in place — it helps the provider dashboards
-- whether or not cancellation exists, and dropping it would be a small
-- performance regression for no gain.
-- ============================================================================
