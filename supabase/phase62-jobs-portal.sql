-- ============================================================
-- Phase 62 — REGO Jobs Portal
-- Centralised tourism jobs board. Verified service providers post
-- vacancies from their existing dashboard, an admin approves them,
-- and approved jobs appear on the public /jobs portal.
--
-- Tables: jobs, job_applicants
-- (`job_applications` from phase 59 is Rego's OWN hiring — separate.)
-- Safe & idempotent to re-run.
-- ============================================================

/* ---------------- jobs ---------------- */
create table if not exists public.jobs (
  id                 uuid primary key default gen_random_uuid(),
  slug               text unique,

  -- Owning business (auto-filled from the provider's registration)
  owner_email        text not null,
  business_name      text not null,
  business_category  text,                 -- hotels | restaurants | transport | ...
  business_logo      text,
  business_verified  boolean not null default false,

  -- Job details
  title              text not null,
  category           text,                 -- job category (Front Office, Kitchen, Driver …)
  description        text,
  responsibilities   text,
  skills             text,
  experience_level   text,                 -- Entry | Junior | Mid | Senior | Any
  employment_type    text not null default 'Full-time',
  workplace_type     text not null default 'On-site',
  vacancies          int not null default 1,

  salary_min         numeric,
  salary_max         numeric,
  salary_period      text default 'month', -- month | day | hour | project
  salary_disclosed   boolean not null default true,

  district           text,
  city               text,

  deadline           date,
  contact_name       text,
  contact_phone      text,
  contact_email      text,

  cv_required        boolean not null default true,
  application_method text not null default 'rego',  -- rego | email | phone | external
  external_url       text,

  -- Workflow
  status             text not null default 'pending',
  -- draft | pending | published | changes_required | rejected | paused | closed | expired
  admin_note         text,
  featured           boolean not null default false,
  urgent             boolean not null default false,
  views              int not null default 0,

  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists jobs_status_idx     on public.jobs (status);
create index if not exists jobs_owner_idx      on public.jobs (owner_email);
create index if not exists jobs_category_idx   on public.jobs (category);
create index if not exists jobs_city_idx       on public.jobs (city);
create index if not exists jobs_bizcat_idx     on public.jobs (business_category);
create index if not exists jobs_published_idx  on public.jobs (published_at desc) where status = 'published';
create index if not exists jobs_slug_idx       on public.jobs (slug);

/* ---------------- job_applicants ---------------- */
create table if not exists public.job_applicants (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.jobs(id) on delete cascade,
  job_title     text,
  owner_email   text,                       -- denormalised: who owns the job

  full_name     text not null,
  email         text not null,
  phone         text,
  location      text,
  intro         text,
  cover_letter  text,
  cv_url        text,

  status        text not null default 'new', -- new | shortlisted | rejected | hired
  provider_note text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- One application per email per job (blocks duplicates).
  constraint job_applicants_unique unique (job_id, email)
);

create index if not exists job_applicants_job_idx    on public.job_applicants (job_id);
create index if not exists job_applicants_owner_idx  on public.job_applicants (owner_email);
create index if not exists job_applicants_email_idx  on public.job_applicants (email);

/* ---------------- RLS ----------------
   Follows the project's permissive-RLS + app-gated pattern used by every
   other module (bookings, messages, listings). Access rules are enforced in
   the data layer: providers only ever query their own owner_email, the
   public portal only ever queries status = 'published', and applicants only
   query their own email.                                                   */
alter table public.jobs           enable row level security;
alter table public.job_applicants enable row level security;

do $$
declare t text;
begin
  foreach t in array array['jobs','job_applicants'] loop
    execute format('drop policy if exists "read %1$s" on public.%1$s', t);
    execute format('create policy "read %1$s" on public.%1$s for select using (true)', t);
    execute format('drop policy if exists "insert %1$s" on public.%1$s', t);
    execute format('create policy "insert %1$s" on public.%1$s for insert with check (true)', t);
    execute format('drop policy if exists "update %1$s" on public.%1$s', t);
    execute format('create policy "update %1$s" on public.%1$s for update using (true) with check (true)', t);
    execute format('drop policy if exists "delete %1$s" on public.%1$s', t);
    execute format('create policy "delete %1$s" on public.%1$s for delete using (true)', t);
  end loop;
end $$;

/* ---------------- keep updated_at fresh ---------------- */
create or replace function public.touch_jobs_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists trg_jobs_touch on public.jobs;
create trigger trg_jobs_touch before update on public.jobs
  for each row execute function public.touch_jobs_updated_at();

drop trigger if exists trg_job_applicants_touch on public.job_applicants;
create trigger trg_job_applicants_touch before update on public.job_applicants
  for each row execute function public.touch_jobs_updated_at();

/* ---------------- auto-expire past-deadline jobs ----------------
   Called by the data layer on every public read, so an expired job stops
   showing without needing a scheduled worker.                           */
create or replace function public.expire_past_deadline_jobs()
returns void language sql as $$
  update public.jobs
     set status = 'expired'
   where status = 'published'
     and deadline is not null
     and deadline < current_date;
$$;
