-- ============================================================
-- Phase 49 — About Us content (admin-manageable, single row)
-- Stores the entire About section as one JSON document so the
-- frontend can render admin-edited content while falling back to
-- the built-in defaults when no row exists. Safe to re-run.
-- ============================================================

create table if not exists public.about_content (
  id         int primary key default 1,
  content    jsonb not null,
  updated_at timestamptz not null default now(),
  constraint about_content_single_row check (id = 1)
);

-- Permissive RLS to match the rest of the project (admin access is gated at
-- the application layer, like hotels / homestays / events, etc.).
alter table public.about_content enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='about_content' and policyname='read about_content') then
    create policy "read about_content" on public.about_content for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='about_content' and policyname='insert about_content') then
    create policy "insert about_content" on public.about_content for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='about_content' and policyname='update about_content') then
    create policy "update about_content" on public.about_content for update using (true) with check (true);
  end if;
end $$;
