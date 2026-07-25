-- ============================================================
-- Phase 57 — Careers / job openings (admin-manageable, single row)
-- Stores all job openings as one JSON document so the /careers page can render
-- admin-edited postings while falling back to the built-in defaults when no
-- row exists. Mirrors phase49 (about) / phase55 (legal). Safe to re-run.
-- ============================================================

create table if not exists public.careers_content (
  id         int primary key default 1,
  content    jsonb not null,
  updated_at timestamptz not null default now(),
  constraint careers_content_single_row check (id = 1)
);

alter table public.careers_content enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='careers_content' and policyname='read careers_content') then
    create policy "read careers_content" on public.careers_content for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='careers_content' and policyname='insert careers_content') then
    create policy "insert careers_content" on public.careers_content for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='careers_content' and policyname='update careers_content') then
    create policy "update careers_content" on public.careers_content for update using (true) with check (true);
  end if;
end $$;
