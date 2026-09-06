/* ============================================================
 * phase107 — team phase 5: leads and the activity log
 *
 * ADDITIVE AND IDEMPOTENT. Two new tables, one helper function.
 * Nothing existing is altered. ROLLBACK at the bottom.
 *
 * ---------------------------------------------------------------------------
 * WHAT A LEAD IS HERE
 *
 * A provider a marketing executive is TALKING TO and who has not registered
 * yet. The moment they register they become a listing, and the referral link
 * credits whoever brought them (phase105). So this table is the part of the
 * work that happens BEFORE there is anything in the database to point at —
 * which is exactly the part that currently lives in somebody's phone.
 *
 * It deliberately does not try to become a CRM. Five stages, one owner, one
 * next action.
 *
 * ---------------------------------------------------------------------------
 * THE ACTIVITY LOG IS APPEND-ONLY
 *
 * No update policy and no delete policy for staff. A log somebody can edit
 * after the fact is not a log, and the whole reason to have one is that it
 * answers "what actually happened" later, when the answer is inconvenient.
 * Admins can delete; nobody can rewrite.
 *
 * ---------------------------------------------------------------------------
 * NOTHING TRUSTS THE CLIENT
 *
 * The browser holds the anon key, so every write goes through RLS. staff_id
 * and created_by are checked against the CALLER in the with-check clause
 * rather than accepted from the request — otherwise anyone could file a lead
 * under a colleague's name and take the credit for it.
 * ============================================================ */

do $$
begin
  if to_regprocedure('public.staff_can(text, uuid)') is null then
    raise exception 'public.staff_can is missing — run phase104-staff-foundation.sql first.';
  end if;
end $$;


/* ============================================================
 * my_staff_id() — the caller's own active staff row.
 *
 * Every policy below needs it. Written once so the "and status =
 * 'active'" is in one place: a suspended member should lose access
 * to leads the same way they lose everything else, and that is easy
 * to forget in the fifth policy that repeats the lookup.
 * ============================================================ */
create or replace function public.my_staff_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id from public.staff_members
   where profile_id = auth.uid() and status = 'active';
$$;

revoke all on function public.my_staff_id() from public, anon;
grant execute on function public.my_staff_id() to authenticated;


/* ============================================================
 * LEADS
 * ============================================================ */
create table if not exists public.staff_leads (
  id uuid primary key default gen_random_uuid(),

  /* Who is working it. One owner: "we are both on it" is how a lead ends up
     with nobody on it. Hand-over is an update, and the log records it. */
  staff_id uuid not null references public.staff_members(id) on delete restrict,

  /* Denormalised so a department view does not join through staff_members,
     and so a lead stays in its department if the person moves. */
  department_id uuid not null references public.staff_departments(id) on delete restrict,

  /* The business, and the person to ring. */
  business_name text not null,
  contact_name  text,
  phone         text,
  whatsapp      text,
  email         text,

  /* Which part of Rego they would list under, if they register. Free text
     against the category slugs rather than a foreign key: the category list
     lives in the app and a lead may be for something we do not list yet. */
  category text,

  /* Where they are. Nullable — a lead phoned from a road sign has no
     district yet, and refusing to record them until it does is worse. */
  location_id uuid references public.locations(id) on delete set null,

  stage text not null default 'new',
  source text,

  note text,

  /* The one date that matters. A lead with no next action is a lead nobody
     is working, and the list can say so. */
  next_follow_up date,

  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint staff_leads_stage_known check (stage in (
    'new','contacted','interested','registered','lost'
  )),
  constraint staff_leads_name_present check (length(trim(business_name)) > 0)
);

create index if not exists staff_leads_staff_idx  on public.staff_leads (staff_id, stage);
create index if not exists staff_leads_dept_idx   on public.staff_leads (department_id, stage);
create index if not exists staff_leads_follow_idx on public.staff_leads (next_follow_up)
  where stage not in ('registered','lost');


/* ============================================================
 * ACTIVITY LOG
 *
 * Attached to a lead, or standing alone — a visit to an existing
 * provider is an activity with no lead.
 * ============================================================ */
create table if not exists public.staff_activities (
  id uuid primary key default gen_random_uuid(),

  staff_id uuid not null references public.staff_members(id) on delete restrict,
  lead_id  uuid references public.staff_leads(id) on delete cascade,

  kind text not null,

  /* When it HAPPENED, which is not when it was typed. Someone logging
     Thursday's visit on Friday should not have Friday in the record. */
  happened_at timestamptz not null default now(),

  note text,

  created_at timestamptz not null default now(),

  constraint staff_activities_kind_known check (kind in (
    'call','whatsapp','visit','meeting','email','note'
  ))
);

create index if not exists staff_activities_staff_idx on public.staff_activities (staff_id, happened_at desc);
create index if not exists staff_activities_lead_idx  on public.staff_activities (lead_id, happened_at desc);


/* ============================================================
 * ROW LEVEL SECURITY
 *
 * Read: your own, always. Somebody else's only with view_leads and
 * only inside your own department — a marketing executive has no
 * business reading the operations team's pipeline, and the brief
 * (§39) asks not to expose more than the work needs.
 *
 * Write: manage_own_leads, and only as yourself.
 * ============================================================ */
alter table public.staff_leads      enable row level security;
alter table public.staff_activities enable row level security;

drop policy if exists staff_leads_read on public.staff_leads;
create policy staff_leads_read on public.staff_leads
  for select using (
    public.is_admin()
    or staff_id = public.my_staff_id()
    or (
      public.staff_can('view_leads')
      and department_id = (
        select department_id from public.staff_members
         where id = public.my_staff_id()
      )
    )
  );

/* staff_id and created_by are CHECKED, not accepted. Without this a request
   could file a lead under a colleague and the pipeline numbers would be
   whatever anyone typed. */
drop policy if exists staff_leads_insert on public.staff_leads;
create policy staff_leads_insert on public.staff_leads
  for insert with check (
    public.staff_can('manage_own_leads')
    and staff_id = public.my_staff_id()
    and created_by = auth.uid()
  );

drop policy if exists staff_leads_update on public.staff_leads;
create policy staff_leads_update on public.staff_leads
  for update
  using (
    public.staff_can('manage_own_leads')
    and staff_id = public.my_staff_id()
  )
  with check (
    /* The row must still be theirs afterwards. Without the with-check they
       could reassign a lead to somebody else on the way out. */
    staff_id = public.my_staff_id()
  );

/* NO DELETE POLICY FOR STAFF. A lead that goes badly becomes 'lost', which
   is a fact worth keeping; a lead that can be deleted is a fact that
   disappears whenever it is unflattering. */
drop policy if exists staff_leads_admin_all on public.staff_leads;
create policy staff_leads_admin_all on public.staff_leads
  for all using (public.is_admin()) with check (public.is_admin());


drop policy if exists staff_activities_read on public.staff_activities;
create policy staff_activities_read on public.staff_activities
  for select using (
    public.is_admin()
    or staff_id = public.my_staff_id()
    or (
      public.staff_can('view_leads')
      and exists (
        select 1 from public.staff_members m
         where m.id = staff_activities.staff_id
           and m.department_id = (
             select department_id from public.staff_members
              where id = public.my_staff_id()
           )
      )
    )
  );

drop policy if exists staff_activities_insert on public.staff_activities;
create policy staff_activities_insert on public.staff_activities
  for insert with check (
    public.staff_can('log_activity')
    and staff_id = public.my_staff_id()
  );

/* APPEND-ONLY: no update policy, no delete policy. Admins get both through
   the policy below, and even then it is deletion, never rewriting. */
drop policy if exists staff_activities_admin_all on public.staff_activities;
create policy staff_activities_admin_all on public.staff_activities
  for all using (public.is_admin()) with check (public.is_admin());


/* Keep updated_at honest without asking the client for it. */
create or replace function public.touch_staff_lead()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists staff_leads_touch on public.staff_leads;
create trigger staff_leads_touch
  before update on public.staff_leads
  for each row execute function public.touch_staff_lead();


/* Empty is correct — nothing has been entered yet.
   The Supabase editor shows only the last result set, so this is last. */
select
  (select count(*) from public.staff_leads)      as leads,
  (select count(*) from public.staff_activities) as activities,
  'Both empty on purpose. No dummy data — see the brief, section 40.' as note;


/* ------------------------------------------------------------------
 * ROLLBACK. Check first, because this one CAN hold real work:
 *   select count(*) from public.staff_leads;
 * ------------------------------------------------------------------ */
-- drop trigger if exists staff_leads_touch on public.staff_leads;
-- drop function if exists public.touch_staff_lead();
-- drop table if exists public.staff_activities;
-- drop table if exists public.staff_leads;
-- drop function if exists public.my_staff_id();
