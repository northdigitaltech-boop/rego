-- ============================================================
-- Phase 68 — Security event log for the /cyber Security Center
--
-- ADDITIVE ONLY. Creates new tables. Does not touch, rename or drop any
-- existing table, column, index or policy. No business logic is affected.
--
-- Design notes:
--  * APPEND-ONLY. There is no UPDATE or DELETE policy on security_events,
--    so evidence cannot be altered or erased through the API — not even by
--    an admin. Only the service role (server routes) can write.
--  * NOTHING SENSITIVE IS STORED. No passwords, OTPs, tokens, cookies, JWT
--    contents or payment data. `metadata` is for non-secret context only.
--  * Reads are admin-only; the /cyber API applies a further email allowlist
--    on top, so a compromised admin account alone is not enough.
--
-- Rollback is at the bottom of this file.
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

/* ---------------- 1. Security events ---------------- */

create table if not exists public.security_events (
  id             uuid primary key default gen_random_uuid(),

  -- what happened
  event_type     text not null,          -- login_failed | authz_violation | rate_limited …
  category       text not null,          -- auth | authz | admin | api | booking | db | upload | session | infra
  severity       text not null default 'info',  -- info | low | medium | high | critical
  risk_score     int  not null default 0,       -- 0–100, see lib/cyber-risk.ts

  -- who
  actor_email    text,
  actor_role     text,
  target_email   text,

  -- where from
  ip_address     text,
  country        text,
  city           text,
  user_agent     text,

  -- what was touched
  endpoint       text,
  http_method    text,
  resource_type  text,
  resource_id    text,
  action         text,
  status         text,                   -- allowed | blocked | failed | success

  -- context
  description    text,
  metadata       jsonb not null default '{}'::jsonb,
  correlation_id text,
  incident_id    uuid,

  detected_at    timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

-- Indexes sized for the queries the dashboard actually runs.
create index if not exists sec_events_time_idx     on public.security_events (detected_at desc);
create index if not exists sec_events_sev_idx      on public.security_events (severity, detected_at desc);
create index if not exists sec_events_cat_idx      on public.security_events (category, detected_at desc);
create index if not exists sec_events_actor_idx    on public.security_events (actor_email, detected_at desc);
create index if not exists sec_events_ip_idx       on public.security_events (ip_address, detected_at desc);
create index if not exists sec_events_incident_idx on public.security_events (incident_id);

alter table public.security_events enable row level security;

-- READ: admins only. No insert/update/delete policies exist, so the anon and
-- authenticated roles cannot write or tamper. Server routes use the service
-- role, which bypasses RLS by design.
drop policy if exists "sec_events_admin_read" on public.security_events;
create policy "sec_events_admin_read" on public.security_events
  for select using (public.is_admin());

comment on table public.security_events is
  'Append-only security telemetry for /cyber. Never store secrets here.';

/* ---------------- 2. Incidents ---------------- */

create table if not exists public.security_incidents (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  severity      text not null default 'medium',
  -- open | investigating | contained | eradicated | recovering | resolved | false_positive
  status        text not null default 'open',
  summary       text,
  root_cause    text,
  attack_vector text,
  containment   text,
  recovery      text,
  lessons       text,
  assigned_to   text,
  opened_by     text,
  detected_at   timestamptz not null default now(),
  resolved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists sec_incidents_status_idx on public.security_incidents (status, detected_at desc);

alter table public.security_incidents enable row level security;

drop policy if exists "sec_incidents_admin_read" on public.security_incidents;
create policy "sec_incidents_admin_read" on public.security_incidents
  for select using (public.is_admin());

/* ---------------- 3. IP reputation ---------------- */

create table if not exists public.ip_reputation (
  ip                text primary key,
  country           text,
  city              text,
  first_seen        timestamptz not null default now(),
  last_seen         timestamptz not null default now(),
  request_count     int not null default 0,
  failed_logins     int not null default 0,
  authz_failures    int not null default 0,
  rate_limit_hits   int not null default 0,
  risk_score        int not null default 0,
  -- none | temporary | allowlisted
  block_status      text not null default 'none',
  blocked_until     timestamptz,
  blocked_reason    text,
  updated_at        timestamptz not null default now()
);

create index if not exists ip_rep_risk_idx  on public.ip_reputation (risk_score desc);
create index if not exists ip_rep_block_idx on public.ip_reputation (block_status, blocked_until);

alter table public.ip_reputation enable row level security;

drop policy if exists "ip_rep_admin_read" on public.ip_reputation;
create policy "ip_rep_admin_read" on public.ip_reputation
  for select using (public.is_admin());

/* ---------------- 4. Vulnerabilities ---------------- */

create table if not exists public.security_vulnerabilities (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  severity       text not null default 'medium',
  source         text,                   -- manual | npm_audit | codeql | dependabot | zap
  component      text,
  description    text,
  evidence       text,
  recommendation text,
  -- open | in_progress | fixed | accepted_risk | false_positive
  status         text not null default 'open',
  detected_at    timestamptz not null default now(),
  fixed_at       timestamptz,
  retest_status  text,
  created_at     timestamptz not null default now()
);

create index if not exists sec_vulns_status_idx on public.security_vulnerabilities (status, severity);

alter table public.security_vulnerabilities enable row level security;

drop policy if exists "sec_vulns_admin_read" on public.security_vulnerabilities;
create policy "sec_vulns_admin_read" on public.security_vulnerabilities
  for select using (public.is_admin());

-- ============================================================
-- ROLLBACK — uncomment and run to undo this migration entirely.
-- Safe: these tables are new and nothing else references them.
-- ============================================================
-- drop table if exists public.security_vulnerabilities;
-- drop table if exists public.ip_reputation;
-- drop table if exists public.security_incidents;
-- drop table if exists public.security_events;
