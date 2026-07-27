-- ============================================================
-- Phase 58 — Auto post-signup reminder flag
-- Adds a per-user flag so the daily reminder cron only emails a
-- newly-registered user once. In-site notifications reuse the
-- existing phase-50 `notifications` table. Safe & idempotent.
-- ============================================================

alter table public.profiles
  add column if not exists signup_reminder_sent boolean not null default false;

-- Helps the cron scan only the recent, not-yet-reminded users quickly.
create index if not exists profiles_reminder_idx
  on public.profiles (created_at)
  where signup_reminder_sent = false;
