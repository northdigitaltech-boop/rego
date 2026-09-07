/* ============================================================
 * phase112 — Super Admin ↔ team member messages
 *
 * ADDITIVE AND IDEMPOTENT. One table. ROLLBACK at the bottom.
 *
 * ---------------------------------------------------------------------------
 * WHY NOT public.messages
 *
 * That table exists and it is not the same thing. It is booking chat: every
 * row hangs off a booking_id, and phase30 gave it
 *
 *     create policy "m_read" on public.messages for select
 *       using (auth.uid() is not null)
 *
 * — any signed-in account can read every row in it. Putting "why was the
 * Hunza listing rejected" in there would publish it to every registered
 * traveller on Rego. So this is a different table for different people with a
 * different rule, not a second copy of the same idea.
 *
 * (That read policy is worth a look on its own. It is not this file's job,
 * and it is recorded here because I noticed it while checking whether the
 * table could be reused.)
 *
 * ---------------------------------------------------------------------------
 * ONE THREAD PER MEMBER, NOT A CHAT SYSTEM
 *
 * staff_id is the thread. A team member has one conversation with the Rego
 * admins; admins see all of them. No channels, no groups, no direct messages
 * between colleagues — those are a different product, and building the
 * general case first is how the simple case ends up worse.
 *
 * ---------------------------------------------------------------------------
 * NOBODY EDITS A SENT MESSAGE
 *
 * No update policy at all. A conversation somebody can rewrite afterwards is
 * not a record of what was said, and both sides of this one make decisions —
 * approvals, targets, corrections — that they may need to point back at.
 * ============================================================ */

do $$
begin
  if to_regprocedure('public.my_staff_id()') is null then
    raise exception 'public.my_staff_id is missing — run phase107-staff-leads.sql first.';
  end if;
end $$;


create table if not exists public.staff_messages (
  id uuid primary key default gen_random_uuid(),

  /* Whose thread this is. An admin writing to a member still files it under
     the member, because "show me everything said to Zuneera" has to have one
     answer. */
  staff_id uuid not null references public.staff_members(id) on delete cascade,

  /* Who typed it. profiles rather than staff_members, because one side of
     every thread is an admin, and admins are deliberately not staff. */
  sender_id uuid not null references public.profiles(id) on delete restrict,

  /* Denormalised at write time so the thread still reads correctly after
     somebody leaves. A message signed "unknown" a year later is a message
     that has lost half its meaning. */
  sender_name text,
  from_admin  boolean not null,

  body text not null,

  /* Set by the reader, so each side can see what the other has not opened
     yet. Nullable: null means unread, and there is no separate flag to fall
     out of step with it. */
  read_at    timestamptz,
  created_at timestamptz not null default now(),

  constraint staff_messages_body_present check (length(trim(body)) > 0),
  constraint staff_messages_body_sane check (length(body) <= 4000)
);

create index if not exists staff_messages_thread_idx
  on public.staff_messages (staff_id, created_at desc);

/* "Anything unread for me" — the badge query, on both sides. */
create index if not exists staff_messages_unread_idx
  on public.staff_messages (staff_id, from_admin)
  where read_at is null;


alter table public.staff_messages enable row level security;

/* A member reads their own thread. Colleagues do not: this is where an
   admin might write "your last three approvals were wrong", and that is
   between the two of them. */
drop policy if exists staff_messages_own on public.staff_messages;
create policy staff_messages_own on public.staff_messages
  for select using (staff_id = public.my_staff_id());

/* And writes into it, as themselves. from_admin is CHECKED rather than
   accepted — otherwise a member could post a message that looks like it came
   from Rego. */
drop policy if exists staff_messages_send on public.staff_messages;
create policy staff_messages_send on public.staff_messages
  for insert with check (
    staff_id = public.my_staff_id()
    and sender_id = auth.uid()
    and from_admin is false
  );

/* Marking as read is the one update a member may make, and only on the
   messages sent TO them. The column grant below stops it becoming an edit. */
drop policy if exists staff_messages_mark_read on public.staff_messages;
create policy staff_messages_mark_read on public.staff_messages
  for update
  using (staff_id = public.my_staff_id() and from_admin is true)
  with check (staff_id = public.my_staff_id() and from_admin is true);

drop policy if exists staff_messages_admin on public.staff_messages;
create policy staff_messages_admin on public.staff_messages
  for all using (public.is_admin()) with check (public.is_admin());


/* ============================================================
 * THE COLUMN GRANT
 *
 * The update policy above permits the ROW; this decides the COLUMN.
 * Without it, "mark as read" would also be permission to rewrite the
 * body of a message somebody else sent — which is exactly the thing
 * the missing update policy was meant to prevent.
 *
 * Same shape as phase108's tasks. The revoke matters as much as the
 * grant: Supabase gives `authenticated` broad privileges by default,
 * so without it the narrower grant adds nothing.
 * ============================================================ */
revoke update on public.staff_messages from authenticated;
grant  update (read_at) on public.staff_messages to authenticated;
grant  select, insert on public.staff_messages to authenticated;


select
  (select count(*) from public.staff_messages) as messages,
  'Empty — nobody has written anything yet.' as note;


/* ------------------------------------------------------------------
 * ROLLBACK. Holds real conversation; check before dropping:
 *   select count(*) from public.staff_messages;
 * ------------------------------------------------------------------ */
-- drop table if exists public.staff_messages;
