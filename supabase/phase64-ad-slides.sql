-- ============================================================
-- Phase 64 — Advertising / promotion carousel
-- Sponsored slides shown on the homepage (after Transport). Admin adds the
-- image + copy; each slide can be scheduled and ordered.
-- NOTE: separate from phase-50 `promotions`, which is provider deal pricing.
-- Safe & idempotent to re-run.
-- ============================================================

create table if not exists public.ad_slides (
  id          uuid primary key default gen_random_uuid(),

  -- Creative
  image       text not null,              -- background image URL (Cloudinary)
  eyebrow     text,                       -- small line above the title
  title       text not null,
  subtitle    text,
  badges      text[] default '{}',        -- e.g. {"7 lakh+ hotels","Free cancellation"}

  -- Call to action
  cta_label   text,
  cta_href    text,
  /* Internal links open in-app; external advertiser links open in a new tab. */
  cta_external boolean not null default false,

  -- Who is advertising (shown as a small "Sponsored by" credit)
  advertiser  text,

  -- Scheduling & ordering
  active      boolean not null default true,
  sort_order  int not null default 0,
  starts_at   date,
  ends_at     date,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists ad_slides_active_idx on public.ad_slides (active, sort_order);

/* ---------------- RLS (permissive, app-gated — project pattern) ---------------- */
alter table public.ad_slides enable row level security;

drop policy if exists "read ad_slides" on public.ad_slides;
create policy "read ad_slides" on public.ad_slides for select using (true);

drop policy if exists "insert ad_slides" on public.ad_slides;
create policy "insert ad_slides" on public.ad_slides for insert with check (true);

drop policy if exists "update ad_slides" on public.ad_slides;
create policy "update ad_slides" on public.ad_slides for update using (true) with check (true);

drop policy if exists "delete ad_slides" on public.ad_slides;
create policy "delete ad_slides" on public.ad_slides for delete using (true);

-- Keep updated_at fresh.
create or replace function public.touch_ad_slides_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists trg_ad_slides_touch on public.ad_slides;
create trigger trg_ad_slides_touch before update on public.ad_slides
  for each row execute function public.touch_ad_slides_updated_at();
