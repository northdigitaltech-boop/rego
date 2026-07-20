-- ============================================================
-- REGO — Phase 56: Expedition module Phase 3
-- Team management + expedition packages (availability + pricing).
--  * expedition_team_members — a company's roster (guides, HAPs, cooks…)
--  * expedition_packages     — sellable expeditions/treks per company with
--    per-person pricing, optional group price tiers, seasons & departures.
-- Follows the module's phase52 conventions (permissive RLS, updated_at).
-- Run in: Supabase → SQL Editor → New query → Run. Safe to re-run.
-- ============================================================

-- ---------- 1. Team members ----------
create table if not exists public.expedition_team_members (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.expedition_companies(id) on delete cascade,
  name          text not null,
  role          text,                 -- e.g. Expedition Leader, High-Altitude Porter, Cook
  photo         text,
  years_experience int,
  peaks_summited text[],
  certifications text[],              -- public display only, no documents
  bio           text,
  display_order int not null default 0,
  created_at    timestamptz default now()
);

-- ---------- 2. Packages ----------
create table if not exists public.expedition_packages (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.expedition_companies(id) on delete cascade,
  owner_email      text,
  title            text not null,
  peak             text,              -- peak name (from expedition_peaks or custom)
  route            text,              -- trek/route name
  duration_days    int,
  group_min        int not null default 1,
  group_max        int,
  price_per_person numeric,           -- base per-person price; null = quote on request
  currency         text not null default 'PKR',
  -- Optional fixed group tiers: [{"min":2,"max":4,"price_per_person":250000}, …]
  group_tiers      jsonb not null default '[]'::jsonb,
  includes         text[],
  excludes         text[],
  season_months    text[],            -- e.g. {June,July,August,September}
  next_departure   date,
  description      text,
  image            text,
  gallery          text[],
  active           boolean not null default true,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists idx_exp_team_company on public.expedition_team_members(company_id);
create index if not exists idx_exp_pkg_company  on public.expedition_packages(company_id);

-- ---------- 3. updated_at trigger for packages ----------
create or replace function public.exp_pkg_touch() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

drop trigger if exists trg_exp_pkg_touch on public.expedition_packages;
create trigger trg_exp_pkg_touch before update on public.expedition_packages
  for each row execute function public.exp_pkg_touch();

-- ---------- 4. Permissive RLS (matches the rest of the module; admin/owner
--             gating happens at the application layer) ----------
alter table public.expedition_team_members enable row level security;
alter table public.expedition_packages     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['expedition_team_members','expedition_packages'] loop
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname=t||'_read') then
      execute format('create policy %I on public.%I for select using (true);', t||'_read', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname=t||'_insert') then
      execute format('create policy %I on public.%I for insert with check (true);', t||'_insert', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname=t||'_update') then
      execute format('create policy %I on public.%I for update using (true) with check (true);', t||'_update', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname=t||'_delete') then
      execute format('create policy %I on public.%I for delete using (true);', t||'_delete', t);
    end if;
  end loop;
end $$;
