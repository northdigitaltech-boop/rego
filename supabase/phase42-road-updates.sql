-- ============================================================
-- REGO — Phase 42: Road Updates & Alerts (Roadside Assistance)
-- Real-time road condition updates for Gilgit-Baltistan.
--   road_updates    — official/verified status per road (public reads verified)
--   road_reports    — community reports (pending until verified)
--   road_reporters  — trusted local reporter allowlist (admin-approved)
--   road_alert_subs — travellers subscribed to a route for alerts
-- Security-first RLS (public / owner / admin), matching phase37/40.
-- Requires phase29 (is_admin).
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

/* ---------------- Official road updates ---------------- */
create table if not exists public.road_updates (
  id                    uuid primary key default gen_random_uuid(),
  road_key              text not null,          -- karakoram-highway | gilgit-skardu | ...
  road_name             text not null,
  location              text,                   -- blocked location
  status                text not null default 'open', -- open | blocked | partial | risky | clearance
  reason                text,                   -- landslide | snow | flood | accident | protest | construction
  description           text,
  safety_message        text,
  source_name           text,
  source_link           text,
  source_type           text,                   -- official | reporter | community | media
  verified              boolean not null default false,
  alert_level           text not null default 'low', -- low | medium | high | critical
  expected_opening_time text,
  alternative_route     text,
  updated_at            timestamptz default now(),
  created_at            timestamptz default now()
);
create index if not exists road_updates_key_idx on public.road_updates (road_key);
create index if not exists road_updates_verified_idx on public.road_updates (verified);

/* ---------------- Community reports ---------------- */
create table if not exists public.road_reports (
  id             uuid primary key default gen_random_uuid(),
  road_key       text not null,
  road_name      text not null,
  location       text,
  reason         text,
  description    text,
  media          text[],                        -- photo/video urls
  reporter_email text not null,
  reporter_name  text,
  reporter_phone text,
  trusted        boolean not null default false, -- snapshotted from road_reporters at submit
  status         text not null default 'pending', -- pending | verified | rejected
  created_at     timestamptz default now()
);
create index if not exists road_reports_key_idx on public.road_reports (road_key);
create index if not exists road_reports_status_idx on public.road_reports (status);
create index if not exists road_reports_reporter_idx on public.road_reports (reporter_email);

/* ---------------- Trusted reporter allowlist ---------------- */
create table if not exists public.road_reporters (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  name       text,
  region     text,                              -- Chilas | Gilgit | Skardu | Hunza | Astore | Nagar | Ghizer | Sost
  phone      text,
  approved   boolean not null default false,
  created_at timestamptz default now()
);
create unique index if not exists road_reporters_email_uidx on public.road_reporters (email);

/* ---------------- Route alert subscriptions ---------------- */
create table if not exists public.road_alert_subs (
  id         uuid primary key default gen_random_uuid(),
  road_key   text not null,
  user_email text not null,
  created_at timestamptz default now()
);
create unique index if not exists road_subs_uidx on public.road_alert_subs (road_key, user_email);

/* ---------------- RLS ---------------- */

-- road_updates: public reads verified; admin manages everything.
do $$
declare pol record;
begin
  execute 'alter table public.road_updates enable row level security';
  for pol in select policyname from pg_policies where schemaname='public' and tablename='road_updates' loop
    execute format('drop policy if exists %I on public.road_updates', pol.policyname);
  end loop;
  create policy "ru_read" on public.road_updates for select
    using (verified = true or public.is_admin());
  create policy "ru_insert" on public.road_updates for insert
    with check (public.is_admin());
  create policy "ru_update" on public.road_updates for update
    using (public.is_admin()) with check (public.is_admin());
  create policy "ru_delete" on public.road_updates for delete
    using (public.is_admin());
end $$;

-- road_reports: any signed-in user submits; reporter sees own; admin sees/manages all.
do $$
declare pol record;
begin
  execute 'alter table public.road_reports enable row level security';
  for pol in select policyname from pg_policies where schemaname='public' and tablename='road_reports' loop
    execute format('drop policy if exists %I on public.road_reports', pol.policyname);
  end loop;
  create policy "rr_read" on public.road_reports for select
    using (reporter_email = auth.email() or public.is_admin());
  create policy "rr_insert" on public.road_reports for insert
    with check (reporter_email = auth.email() or public.is_admin());
  create policy "rr_update" on public.road_reports for update
    using (public.is_admin()) with check (public.is_admin());
  create policy "rr_delete" on public.road_reports for delete
    using (reporter_email = auth.email() or public.is_admin());
end $$;

-- road_reporters: applicant sees/creates own (approved=false); admin manages all.
do $$
declare pol record;
begin
  execute 'alter table public.road_reporters enable row level security';
  for pol in select policyname from pg_policies where schemaname='public' and tablename='road_reporters' loop
    execute format('drop policy if exists %I on public.road_reporters', pol.policyname);
  end loop;
  create policy "rep_read" on public.road_reporters for select
    using (email = auth.email() or public.is_admin());
  create policy "rep_insert" on public.road_reporters for insert
    with check (email = auth.email() or public.is_admin());
  create policy "rep_update" on public.road_reporters for update
    using (public.is_admin()) with check (public.is_admin());
  create policy "rep_delete" on public.road_reporters for delete
    using (public.is_admin());
end $$;

-- road_alert_subs: user owns their subscriptions; admin can read (for sending alerts).
do $$
declare pol record;
begin
  execute 'alter table public.road_alert_subs enable row level security';
  for pol in select policyname from pg_policies where schemaname='public' and tablename='road_alert_subs' loop
    execute format('drop policy if exists %I on public.road_alert_subs', pol.policyname);
  end loop;
  create policy "sub_read" on public.road_alert_subs for select
    using (user_email = auth.email() or public.is_admin());
  create policy "sub_insert" on public.road_alert_subs for insert
    with check (user_email = auth.email());
  create policy "sub_delete" on public.road_alert_subs for delete
    using (user_email = auth.email() or public.is_admin());
end $$;
