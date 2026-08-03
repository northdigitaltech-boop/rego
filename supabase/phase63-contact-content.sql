-- ============================================================
-- Phase 63 — Admin-editable Contact page
-- Single-row JSON content table (same pattern as about_content,
-- legal_content and careers_content). Safe & idempotent to re-run.
-- ============================================================

create table if not exists public.contact_content (
  id         int primary key default 1,
  content    jsonb not null,
  updated_at timestamptz not null default now(),
  constraint contact_content_single_row check (id = 1)
);

alter table public.contact_content enable row level security;

drop policy if exists "read contact_content" on public.contact_content;
create policy "read contact_content" on public.contact_content for select using (true);

drop policy if exists "insert contact_content" on public.contact_content;
create policy "insert contact_content" on public.contact_content for insert with check (true);

drop policy if exists "update contact_content" on public.contact_content;
create policy "update contact_content" on public.contact_content for update using (true) with check (true);
