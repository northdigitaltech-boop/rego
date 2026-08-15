-- ============================================================
-- Phase 66 — Blocking and reporting
--
-- Two safety primitives the platform was missing:
--   * user_blocks  — "I never want to hear from this person again"
--   * user_reports — "someone should look at this account / listing"
--
-- Blocking is one-directional and private: the blocked person is never told.
-- Reports are write-only for the reporter and readable only by admins, so a
-- reporter can never be identified by the person they reported.
-- ============================================================

/* ---------------- blocks ---------------- */

create table if not exists public.user_blocks (
  id            uuid primary key default gen_random_uuid(),
  blocker_email text not null,
  blocked_email text not null,
  reason        text,
  created_at    timestamptz not null default now(),
  unique (blocker_email, blocked_email),
  check (blocker_email <> blocked_email)
);

create index if not exists user_blocks_blocker_idx on public.user_blocks (blocker_email);
create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_email);

alter table public.user_blocks enable row level security;

-- You can only see, create and remove your OWN blocks.
drop policy if exists "blocks read own" on public.user_blocks;
create policy "blocks read own" on public.user_blocks
  for select using (blocker_email = auth.email() or public.is_admin());

drop policy if exists "blocks insert own" on public.user_blocks;
create policy "blocks insert own" on public.user_blocks
  for insert with check (blocker_email = auth.email());

drop policy if exists "blocks delete own" on public.user_blocks;
create policy "blocks delete own" on public.user_blocks
  for delete using (blocker_email = auth.email() or public.is_admin());

/* ---------------- reports ---------------- */

create table if not exists public.user_reports (
  id              uuid primary key default gen_random_uuid(),
  -- who is reporting (never shown to the reported party)
  reporter_email  text not null,
  -- what is being reported
  target_type     text not null,          -- solo | listing | story | review | message | job
  target_id       text not null,
  target_email    text,                   -- owner, when known
  reason          text not null,          -- short code, see REPORT_REASONS
  details         text,
  -- moderation
  status          text not null default 'open',   -- open | reviewing | actioned | dismissed
  admin_notes     text,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists user_reports_status_idx on public.user_reports (status, created_at desc);
create index if not exists user_reports_target_idx on public.user_reports (target_type, target_id);

alter table public.user_reports enable row level security;

-- Anyone signed in may file a report...
drop policy if exists "reports insert own" on public.user_reports;
create policy "reports insert own" on public.user_reports
  for insert with check (reporter_email = auth.email());

-- ...but only admins can read them. A reporter cannot be unmasked.
drop policy if exists "reports read admin" on public.user_reports;
create policy "reports read admin" on public.user_reports
  for select using (public.is_admin());

drop policy if exists "reports update admin" on public.user_reports;
create policy "reports update admin" on public.user_reports
  for update using (public.is_admin()) with check (public.is_admin());

/* ---------------- connection blocking ---------------- */

-- 'blocked' joins pending | accepted | rejected as a connection outcome.
comment on column public.solo_connections.status is
  'pending | accepted | rejected | blocked';
