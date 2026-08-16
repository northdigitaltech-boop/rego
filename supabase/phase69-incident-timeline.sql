-- ============================================================
-- REGO — Phase 69: incident timeline + evidence links
--
-- Adds two APPEND-ONLY tables supporting the Cyber Center's
-- incident workflow. Neither has an UPDATE or DELETE policy, so
-- even a compromised admin session cannot rewrite or erase the
-- record of what happened — writes go through the service role
-- only, and history accumulates rather than being edited.
--
-- Nothing here touches an existing table. Rollback at the bottom.
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

/* ---------------- 1. Incident timeline ----------------
   Every status change and every analyst comment is a new row.
   security_incidents.status is the CURRENT value; this table is
   how it got there. Deliberately no edit path: an incident log
   you can quietly correct is not evidence. */
create table if not exists public.security_incident_notes (
  id           uuid primary key default gen_random_uuid(),
  incident_id  uuid not null references public.security_incidents(id) on delete restrict,
  author_email text not null,
  -- note | status_change | containment | recovery | evidence
  kind         text not null default 'note',
  body         text not null,
  status_from  text,
  status_to    text,
  created_at   timestamptz not null default now()
);

create index if not exists sec_notes_incident_idx
  on public.security_incident_notes (incident_id, created_at);

alter table public.security_incident_notes enable row level security;

-- Read-only for admins. No insert/update/delete policy exists on
-- purpose: only the service role (server-side) may write.
drop policy if exists "sec_notes_admin_read" on public.security_incident_notes;
create policy "sec_notes_admin_read" on public.security_incident_notes
  for select using (public.is_admin());


/* ---------------- 2. Evidence links ----------------
   Ties immutable security_events rows to an incident. The events
   themselves are never copied or modified — this only records
   which ones an analyst considered relevant, and who said so. */
create table if not exists public.security_incident_events (
  incident_id uuid not null references public.security_incidents(id) on delete restrict,
  event_id    uuid not null references public.security_events(id)    on delete restrict,
  linked_by   text not null,
  linked_at   timestamptz not null default now(),
  -- Why this event was attached. Free text, kept for the audit trail.
  rationale   text,
  primary key (incident_id, event_id)
);

create index if not exists sec_inc_events_event_idx
  on public.security_incident_events (event_id);

alter table public.security_incident_events enable row level security;

drop policy if exists "sec_inc_events_admin_read" on public.security_incident_events;
create policy "sec_inc_events_admin_read" on public.security_incident_events
  for select using (public.is_admin());


/* ---------------- 3. Detection provenance ----------------
   Which code-defined rule opened an incident. Detection rules live
   in src/lib/threat-rules.ts, not in the database, so they are
   version-controlled and reviewable in a pull request — an admin
   cannot silently weaken a threshold from inside the portal. */
alter table public.security_incidents
  add column if not exists detected_by_rule text;

alter table public.security_incidents
  add column if not exists rule_version int;


-- ============================================================
-- VERIFY
-- ============================================================
select
  c.relname                             as table_name,
  c.relrowsecurity                      as rls_enabled,
  (select count(*) from pg_policies p
     where p.schemaname = 'public' and p.tablename = c.relname) as policy_count,
  (select count(*) from pg_policies p
     where p.schemaname = 'public' and p.tablename = c.relname
       and p.cmd in ('INSERT','UPDATE','DELETE'))               as write_policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('security_incident_notes','security_incident_events')
order by c.relname;
-- Expected: rls_enabled = true, policy_count = 1, write_policies = 0.
-- A non-zero write_policies means the append-only guarantee is broken.


-- ============================================================
-- ROLLBACK — uncomment and run to undo this migration.
-- Note: this destroys incident history. Export it first if the
-- incidents it describes are still open.
-- ============================================================
-- alter table public.security_incidents drop column if exists rule_version;
-- alter table public.security_incidents drop column if exists detected_by_rule;
-- drop table if exists public.security_incident_events;
-- drop table if exists public.security_incident_notes;
