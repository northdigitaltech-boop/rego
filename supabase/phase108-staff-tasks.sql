/* ============================================================
 * phase108 — team phase 6: assigned work
 *
 * ADDITIVE AND IDEMPOTENT. One table. ROLLBACK at the bottom.
 *
 * ---------------------------------------------------------------------------
 * COLUMN GRANTS, NOT JUST ROW POLICIES
 *
 * The permission is called `update_own_tasks`, and what it should mean is
 * "move your task along" — not "rewrite what you were asked to do". A row
 * policy cannot express that: it decides WHICH ROWS you may update, never
 * WHICH COLUMNS.
 *
 * So the update grant is narrowed to the columns a person legitimately
 * changes about their own work:
 *
 *   revoke update on staff_tasks from authenticated;
 *   grant  update (status, progress_note) ...
 *
 * Postgres then refuses `update staff_tasks set due_date = ...` before any
 * policy is consulted. Somebody who has slipped a deadline cannot quietly
 * move it, and somebody who was asked to do X cannot make the record say
 * they were asked to do Y.
 *
 * Assignment stays with admins. There is no `assign_tasks` permission in
 * phase104, and inventing one here would be a permission the Super Admin
 * screens never granted and nobody reviewed.
 * ============================================================ */

do $$
begin
  if to_regprocedure('public.my_staff_id()') is null then
    raise exception 'public.my_staff_id is missing — run phase107-staff-leads.sql first.';
  end if;
end $$;


create table if not exists public.staff_tasks (
  id uuid primary key default gen_random_uuid(),

  /* Who is doing it. One assignee — a task with two owners is a task with
     none, and "who was this waiting on" has to have an answer. */
  staff_id uuid not null references public.staff_members(id) on delete restrict,

  /* Kept alongside so a department view needs no join, and so the task stays
     with the department if the person moves. */
  department_id uuid not null references public.staff_departments(id) on delete restrict,

  title  text not null,
  detail text,

  priority text not null default 'normal',
  status   text not null default 'todo',

  due_date date,

  /* Where relevant. Nullable: most tasks are not about a place. */
  location_id uuid references public.locations(id) on delete set null,

  /* The assignee's own running note. Separate from `detail`, which is what
     they were ASKED to do — one is the instruction and one is the reply, and
     collapsing them loses which is which. */
  progress_note text,

  assigned_by uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  /* Stamped by the trigger when status first becomes 'done', never by hand. */
  completed_at timestamptz,

  constraint staff_tasks_status_known check (status in (
    'todo','in_progress','blocked','done','cancelled'
  )),
  constraint staff_tasks_priority_known check (priority in ('low','normal','high')),
  constraint staff_tasks_title_present check (length(trim(title)) > 0)
);

create index if not exists staff_tasks_staff_idx on public.staff_tasks (staff_id, status);
create index if not exists staff_tasks_dept_idx  on public.staff_tasks (department_id, status);
create index if not exists staff_tasks_due_idx   on public.staff_tasks (due_date)
  where status in ('todo','in_progress','blocked');


/* ============================================================
 * ROW LEVEL SECURITY
 * ============================================================ */
alter table public.staff_tasks enable row level security;

drop policy if exists staff_tasks_read on public.staff_tasks;
create policy staff_tasks_read on public.staff_tasks
  for select using (
    public.is_admin()
    or staff_id = public.my_staff_id()
    or (
      public.staff_can('view_tasks')
      and department_id = (
        select department_id from public.staff_members
         where id = public.my_staff_id()
      )
    )
  );

/* Only your own row, only with the permission, and it must still be yours
   afterwards — otherwise a task could be pushed onto somebody else. Which
   COLUMNS may change is settled by the grants below, not here. */
drop policy if exists staff_tasks_update_own on public.staff_tasks;
create policy staff_tasks_update_own on public.staff_tasks
  for update
  using (
    public.staff_can('update_own_tasks')
    and staff_id = public.my_staff_id()
  )
  with check (staff_id = public.my_staff_id());

/* No insert and no delete policy for staff. Assigning work is an admin act,
   and a task somebody can delete is a task that vanishes the week it is
   overdue. */
drop policy if exists staff_tasks_admin_all on public.staff_tasks;
create policy staff_tasks_admin_all on public.staff_tasks
  for all using (public.is_admin()) with check (public.is_admin());


/* ============================================================
 * THE COLUMN GRANTS
 *
 * Supabase gives `authenticated` broad table privileges by default,
 * so this REVOKES first. Without the revoke the narrower grant adds
 * nothing and the whole protection above is decorative.
 *
 * The service-role client used by /api/admin/staff is unaffected —
 * it bypasses both grants and RLS, which is why assignment lives
 * there.
 * ============================================================ */
revoke update on public.staff_tasks from authenticated;
grant  update (status, progress_note) on public.staff_tasks to authenticated;
grant  select on public.staff_tasks to authenticated;


/* completed_at is set here, not by the client, so "when was this finished"
   cannot be backdated by whoever finished it late. */
create or replace function public.touch_staff_task()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();

  if new.status = 'done' and coalesce(old.status, '') <> 'done' then
    new.completed_at := now();
  elsif new.status <> 'done' then
    /* Reopened. Clearing it keeps completed_at meaning "finished", rather
       than "was finished once, at some point, maybe". */
    new.completed_at := null;
  end if;

  return new;
end $$;

drop trigger if exists staff_tasks_touch on public.staff_tasks;
create trigger staff_tasks_touch
  before update on public.staff_tasks
  for each row execute function public.touch_staff_task();


select
  (select count(*) from public.staff_tasks) as tasks,
  'Empty on purpose — no dummy data.'       as note;


/* ------------------------------------------------------------------
 * ROLLBACK. Check first:  select count(*) from public.staff_tasks;
 * ------------------------------------------------------------------ */
-- drop trigger if exists staff_tasks_touch on public.staff_tasks;
-- drop function if exists public.touch_staff_task();
-- drop table if exists public.staff_tasks;
