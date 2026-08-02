-- ============================================================
-- Phase 60 — Multi-service provider accounts
-- One login (one email) can operate several services, e.g. a hotel
-- AND transport AND guiding. Each extra service is requested by the
-- owner and must be APPROVED by an admin before it goes live.
-- Safe & idempotent to re-run.
-- ============================================================

create table if not exists public.provider_services (
  id           uuid primary key default gen_random_uuid(),
  owner_email  text not null,
  category     text not null,                 -- hotels | transport | guides | ...
  status       text not null default 'pending', -- pending | approved | rejected
  note         text,                          -- owner's short description / business name
  admin_note   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- One row per owner per service.
  constraint provider_services_unique unique (owner_email, category)
);

create index if not exists provider_services_owner_idx  on public.provider_services (owner_email);
create index if not exists provider_services_status_idx on public.provider_services (status);

/* ---------------- RLS (permissive, app-gated — matches project pattern) ---------------- */
alter table public.provider_services enable row level security;

drop policy if exists "read provider_services" on public.provider_services;
create policy "read provider_services" on public.provider_services for select using (true);

drop policy if exists "insert provider_services" on public.provider_services;
create policy "insert provider_services" on public.provider_services for insert with check (true);

drop policy if exists "update provider_services" on public.provider_services;
create policy "update provider_services" on public.provider_services for update using (true) with check (true);

drop policy if exists "delete provider_services" on public.provider_services;
create policy "delete provider_services" on public.provider_services for delete using (true);

-- Keep updated_at fresh.
create or replace function public.touch_provider_services_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists trg_provider_services_touch on public.provider_services;
create trigger trg_provider_services_touch before update on public.provider_services
  for each row execute function public.touch_provider_services_updated_at();

/* ---------------- Backfill ----------------
   Every existing partner keeps the service they already registered with,
   already approved, so nothing breaks for current providers.            */
insert into public.provider_services (owner_email, category, status)
select lower(p.email), p.business_category, 'approved'
from public.profiles p
where p.role = 'partner'
  and p.email is not null
  and p.business_category is not null
  and p.business_category <> ''
on conflict (owner_email, category) do nothing;
