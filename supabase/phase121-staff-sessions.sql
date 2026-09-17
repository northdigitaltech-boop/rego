/* ============================================================
 * phase121 — staff_sessions
 *
 * How often a team member opens the portal, and roughly how long
 * they stay. staff_members.last_seen_at answers "recently?" and
 * nothing else; this answers "are they actually using it?".
 *
 * ---------------------------------------------------------------
 * WHAT THIS IS, AND WHAT IT IS NOT
 *
 * It is a count of visits and an approximate duration. It is NOT
 * a record of what somebody looked at, clicked, or typed. No page
 * paths, no actions, no keystrokes, and deliberately so — the
 * question being answered is "is this tool being used", not "what
 * is this person doing minute by minute".
 *
 * DURATION IS APPROXIMATE AND THE SCHEMA SAYS SO
 *   last_beat_at is refreshed about every 60 seconds while the tab
 *   is open and visible. So a session is accurate to the nearest
 *   minute, and a tab left open on a locked laptop counts as
 *   "open" — because from the database's side it is. Anyone
 *   reading these numbers as hours worked will be wrong, and the
 *   column comments say that rather than leaving it to be assumed.
 *
 * THE MEMBER CAN SEE THEIR OWN
 *   A staff member reads their own sessions. Measuring somebody
 *   and hiding the measurement from them is the part that turns
 *   analytics into surveillance, and there is no reason for it
 *   here.
 *
 * ROLLBACK: at the bottom. Safe — nothing depends on this table.
 * ============================================================ */

do $$
begin
  if to_regclass('public.staff_members') is null then
    raise exception 'public.staff_members is missing — run phase104 first.';
  end if;
  if to_regprocedure('public.my_staff_id()') is null then
    raise exception 'public.my_staff_id() is missing — run phase107 first.';
  end if;
end $$;


create table if not exists public.staff_sessions (
  id           uuid primary key default gen_random_uuid(),
  staff_id     uuid not null references public.staff_members(id) on delete cascade,

  started_at   timestamptz not null default now(),

  /* Refreshed while the tab is open and visible. The gap between this and
     started_at IS the duration — there is no separate "ended" event, because
     browsers do not reliably fire one when a tab is closed or a phone
     sleeps. A session simply stops being beaten. */
  last_beat_at timestamptz not null default now(),

  /* Minutes, derived. Stored rather than computed on read so a year of
     history does not have to be recalculated for every dashboard load. */
  duration_minutes int generated always as (
    greatest(0, floor(extract(epoch from (last_beat_at - started_at)) / 60))::int
  ) stored,

  created_at   timestamptz not null default now()
);

comment on column public.staff_sessions.duration_minutes is
  'APPROXIMATE. Beaten every ~60s while the tab is open and visible. A tab '
  'left open counts as time in the portal. Not a record of hours worked.';

create index if not exists staff_sessions_staff_idx
  on public.staff_sessions (staff_id, started_at desc);

/* Finding the session to beat. Partial, on recent rows only — the lookup
   never cares about last month's. */
create index if not exists staff_sessions_recent_idx
  on public.staff_sessions (staff_id, last_beat_at desc);


/* ============================================================
 * THE ONLY WAY TO WRITE ONE
 *
 * A single function, called by the portal. It starts a session or
 * extends the current one, and the caller cannot say which — so a
 * client cannot invent a hundred visits or a session that lasted
 * a week.
 *
 * SECURITY DEFINER, and it derives the staff id from auth.uid().
 * The caller passes nothing at all.
 * ============================================================ */
create or replace function public.touch_staff_session()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_staff_id uuid;
  v_session  uuid;
begin
  v_staff_id := public.my_staff_id();
  if v_staff_id is null then
    /* Not staff, or suspended. Returns null rather than raising: the portal
       calls this on a timer and an exception every 60 seconds in somebody's
       console helps nobody. */
    return null;
  end if;

  /* Continue the open session if one was beaten in the last 30 minutes.
     Longer than the 60s heartbeat so a tunnel, a meeting or a closed laptop
     does not split one afternoon into six "visits"; short enough that
     tomorrow morning is a new one. */
  select id into v_session
    from public.staff_sessions
   where staff_id = v_staff_id
     and last_beat_at > now() - interval '30 minutes'
   order by last_beat_at desc
   limit 1;

  if v_session is not null then
    update public.staff_sessions
       set last_beat_at = now()
     where id = v_session;
  else
    insert into public.staff_sessions (staff_id)
    values (v_staff_id)
    returning id into v_session;
  end if;

  /* Keep the existing last_seen_at in step, so nothing that already reads it
     has to learn about this table. */
  update public.staff_members set last_seen_at = now() where id = v_staff_id;

  return v_session;
end $fn$;

revoke all on function public.touch_staff_session() from public, anon;
grant execute on function public.touch_staff_session() to authenticated;


/* ============================================================
 * RLS
 *
 * No insert or update policy exists, deliberately: every write
 * goes through touch_staff_session(), which is SECURITY DEFINER.
 * Under RLS that means a client cannot write a session row at all.
 * ============================================================ */
alter table public.staff_sessions enable row level security;

drop policy if exists staff_sessions_own_read on public.staff_sessions;
create policy staff_sessions_own_read on public.staff_sessions
  for select to authenticated
  using (staff_id = public.my_staff_id());

drop policy if exists staff_sessions_admin_read on public.staff_sessions;
create policy staff_sessions_admin_read on public.staff_sessions
  for select to authenticated
  using (public.is_admin());

grant select on public.staff_sessions to authenticated;


/* ============================================================
 * ROLL-UP — one row per member, for the analytics screen.
 *
 * A view rather than a query in the app, so the numbers cannot
 * differ between two screens that both wanted "sessions this
 * month".
 * ============================================================ */
create or replace view public.staff_session_summary as
select
  s.staff_id,
  count(*)                                             as sessions_total,
  count(*) filter (where s.started_at > now() - interval '30 days')
                                                       as sessions_30d,
  count(*) filter (where s.started_at > now() - interval '7 days')
                                                       as sessions_7d,
  coalesce(sum(s.duration_minutes), 0)                 as minutes_total,
  coalesce(sum(s.duration_minutes) filter
    (where s.started_at > now() - interval '30 days'), 0) as minutes_30d,
  max(s.last_beat_at)                                  as last_seen_at,
  min(s.started_at)                                    as first_seen_at
from public.staff_sessions s
group by s.staff_id;

/* The view inherits the table's RLS: a member sees their own row, an admin
   sees every row. No separate policy needed, and none should be added —
   a view with its own rules is how two sources of truth appear. */
grant select on public.staff_session_summary to authenticated;


select
  (select count(*) from public.staff_sessions) as sessions,
  'Empty. Rows appear as team members open the portal.' as note;


/* ------------------------------------------------------------------
 * ROLLBACK
 *
 *   drop view if exists public.staff_session_summary;
 *   drop function if exists public.touch_staff_session();
 *   drop table if exists public.staff_sessions;
 *
 * Safe: nothing else reads these. last_seen_at on staff_members is
 * written by this function but also by phase106's touch_staff_seen(),
 * so dropping this does not stop it being updated.
 * ------------------------------------------------------------------ */
