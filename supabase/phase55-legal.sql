-- ============================================================
-- Phase 55 — Legal & policy content (admin-manageable, single row)
-- Stores all nine policies as one JSON document so the frontend can render
-- admin-edited content while falling back to the built-in defaults when no
-- row exists. Mirrors phase49 (about_content). Safe to re-run.
-- ============================================================

create table if not exists public.legal_content (
  id         int primary key default 1,
  content    jsonb not null,
  updated_at timestamptz not null default now(),
  constraint legal_content_single_row check (id = 1)
);

-- Permissive RLS to match the rest of the project (admin access is gated at
-- the application layer, like about_content / hotels / events, etc.).
alter table public.legal_content enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='legal_content' and policyname='read legal_content') then
    create policy "read legal_content" on public.legal_content for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='legal_content' and policyname='insert legal_content') then
    create policy "insert legal_content" on public.legal_content for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='legal_content' and policyname='update legal_content') then
    create policy "update legal_content" on public.legal_content for update using (true) with check (true);
  end if;
end $$;
