-- ============================================================
-- Phase 59 — Careers: job applications
-- Stores applications submitted from /careers. Follows the project's
-- permissive-RLS + app-gated pattern (same as bookings/messages).
-- Safe & idempotent to re-run.
-- ============================================================

create table if not exists public.job_applications (
  id            uuid primary key default gen_random_uuid(),
  job_id        text,                     -- matches JobOpening.id ('' = open application)
  job_title     text not null,
  department    text,
  full_name     text not null,
  email         text not null,
  phone         text,
  city          text,
  experience    text,                     -- years / background summary
  cover_note    text,
  cv_url        text,                     -- uploaded file (Cloudinary) or pasted link
  skills        text[] default '{}',      -- marketing skills (multi-select)
  ran_paid_ads  text,                     -- yes | no | some
  tourism_exp   text,                     -- yes | no | some
  has_vehicle   text,                     -- yes | no
  can_travel    text,                     -- yes | no
  portfolio_url text,
  status        text not null default 'new',  -- new | shortlisted | interview | rejected | hired
  admin_note    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Marketing / role screening answers (added after first draft — safe to re-run).
alter table public.job_applications
  add column if not exists skills          text[] default '{}',
  add column if not exists ran_paid_ads    text,   -- yes | no | some
  add column if not exists tourism_exp     text,   -- yes | no | some
  add column if not exists has_vehicle     text,   -- yes | no
  add column if not exists can_travel      text,   -- yes | no
  add column if not exists portfolio_url   text;

create index if not exists job_apps_job_idx     on public.job_applications (job_id);
create index if not exists job_apps_status_idx  on public.job_applications (status);
create index if not exists job_apps_created_idx on public.job_applications (created_at desc);

/* ---------------- RLS (permissive, app-gated — matches project pattern) ---------------- */
alter table public.job_applications enable row level security;

drop policy if exists "read job_applications" on public.job_applications;
create policy "read job_applications" on public.job_applications for select using (true);

drop policy if exists "insert job_applications" on public.job_applications;
create policy "insert job_applications" on public.job_applications for insert with check (true);

drop policy if exists "update job_applications" on public.job_applications;
create policy "update job_applications" on public.job_applications for update using (true) with check (true);

drop policy if exists "delete job_applications" on public.job_applications;
create policy "delete job_applications" on public.job_applications for delete using (true);

-- Keep updated_at fresh.
create or replace function public.touch_job_applications_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists trg_job_apps_touch on public.job_applications;
create trigger trg_job_apps_touch before update on public.job_applications
  for each row execute function public.touch_job_applications_updated_at();
