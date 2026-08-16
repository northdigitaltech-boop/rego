-- ============================================================
-- REGO — Phase 70: containment action log
--
-- One APPEND-ONLY table recording every emergency action taken
-- from the Cyber Center: who did it, to what, why, and whether
-- it was later reversed.
--
-- A reversal is a NEW ROW, never an edit of the original. The
-- point of this table is that the record of "we banned this
-- account at 3am" survives even if someone later decides it was
-- embarrassing.
--
-- Nothing here modifies an existing table. Rollback at the bottom.
-- Run in: Supabase → SQL Editor → New query → Run
-- PREREQUISITES: phase29 (is_admin), phase68 (security_events).
-- ============================================================

create table if not exists public.security_actions (
  id           uuid primary key default gen_random_uuid(),

  -- block_ip | unblock_ip | ban_user | unban_user
  action       text not null,
  -- ip | account
  target_kind  text not null,
  target       text not null,

  actor_email  text not null,
  reason       text not null,

  -- How long the containment was meant to last, in hours.
  duration_h   int,
  expires_at   timestamptz,

  -- Set by the reversing row, so a glance shows what is still active.
  reversed_at     timestamptz,
  reversed_by     text,
  reverses_action uuid references public.security_actions(id) on delete restrict,

  created_at   timestamptz not null default now()
);

create index if not exists sec_actions_target_idx
  on public.security_actions (target_kind, target, created_at desc);
create index if not exists sec_actions_active_idx
  on public.security_actions (created_at desc) where reversed_at is null;

alter table public.security_actions enable row level security;

-- Admin read only. No insert/update/delete policy exists by design:
-- writes go through the service role, server-side, never from a browser.
drop policy if exists "sec_actions_admin_read" on public.security_actions;
create policy "sec_actions_admin_read" on public.security_actions
  for select using (public.is_admin());


-- ============================================================
-- VERIFY — write_policies must be 0, rls must be true.
-- ============================================================
select
  c.relname                        as table_name,
  c.relrowsecurity                 as rls_enabled,
  (select count(*) from pg_policies p
     where p.schemaname = 'public' and p.tablename = c.relname
       and p.cmd in ('INSERT','UPDATE','DELETE')) as write_policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'security_actions';


-- ============================================================
-- ROLLBACK — destroys the containment history. Export first if
-- any block or ban is still in force.
-- ============================================================
-- drop table if exists public.security_actions;
