-- ============================================================
-- SAFARIGB — Phase 36: Events & Expo (admin-managed)
-- A catalogue of events curated entirely by admins — there is NO provider /
-- owner registration for this module. Customers only browse published events.
--   read:  published rows (or admin sees everything, incl. drafts)
--   write: admin only (create / edit / delete)
-- Requires phase29 (is_admin).
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

create table if not exists public.events (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  category         text not null,   -- festivals | tourism-events | local-expos | adventure-events | cultural-events
  description      text,
  city             text,
  venue            text,
  address          text,
  start_date       date,
  end_date         date,
  time             text,            -- free text, e.g. "10:00 AM – 6:00 PM"
  image            text,            -- cover image
  gallery          text[],
  organizer        text,
  ticket_price     numeric not null default 0,  -- 0 = free
  ticket_info      text,            -- how to attend / contact
  registration_url text,
  highlights       text[],
  featured         boolean not null default false,
  status           text not null default 'published', -- published | draft
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
create index if not exists events_category_idx on public.events (category);
create index if not exists events_status_idx on public.events (status);
create index if not exists events_start_idx on public.events (start_date);

alter table public.events enable row level security;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname='public' and tablename='events' loop
    execute format('drop policy if exists %I on public.events', pol.policyname);
  end loop;
  -- Public reads published events; admins read everything.
  create policy "events_read" on public.events for select
    using (status = 'published' or public.is_admin());
  -- Only admins may create / edit / delete.
  create policy "events_insert" on public.events for insert
    with check (public.is_admin());
  create policy "events_update" on public.events for update
    using (public.is_admin()) with check (public.is_admin());
  create policy "events_delete" on public.events for delete
    using (public.is_admin());
end $$;
