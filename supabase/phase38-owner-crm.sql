-- ============================================================
-- SAFARIGB — Phase 38: Owner CRM & Customer Visit Analytics
-- Per-owner CRM (leads, follow-ups, private notes) + a customer visit/action
-- event log. Ownership is keyed on owner_email = auth.email(); admins via
-- public.is_admin(). Each owner sees ONLY their own rows.
--
-- Privacy: analytics events never store customer name / phone / email. They may
-- store an anonymous visitor_id and (if signed in) user_email for unique/repeat
-- counting only — the CRM UI shows analytics as numbers, not identities.
-- Requires phase29 (is_admin).
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

/* ---------------- Leads ---------------- */
create table if not exists public.owner_leads (
  id                 uuid primary key default gen_random_uuid(),
  owner_email        text not null,
  listing_id         uuid,
  listing_type       text,
  interested_service text,
  customer_name      text,
  phone              text,
  email              text,
  city               text,
  country            text,
  check_in_date      date,
  check_out_date     date,
  travel_date        date,
  guests             int,
  budget             numeric,
  lead_source        text,     -- whatsapp | phone | facebook | instagram | tiktok | referral | walk-in | direct | other
  lead_status        text not null default 'new',   -- new | contacted | interested | follow-up | confirmed | lost
  pipeline_stage     text,     -- new-request | contacted | confirmed | payment-pending | booked | completed | review-requested | cancelled
  amount             numeric,
  follow_up_datetime timestamptz,
  notes              text,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);
create index if not exists owner_leads_owner_idx on public.owner_leads (owner_email);
create index if not exists owner_leads_status_idx on public.owner_leads (lead_status);

/* ---------------- Follow-ups ---------------- */
create table if not exists public.owner_followups (
  id             uuid primary key default gen_random_uuid(),
  owner_email    text not null,
  lead_id        uuid references public.owner_leads(id) on delete set null,
  customer_email text,
  customer_name  text,
  phone          text,
  booking_id     uuid,
  listing_id     uuid,
  related_service text,
  follow_up_date date,
  follow_up_time text,
  priority       text not null default 'medium',  -- low | medium | high | urgent
  note           text,
  status         text not null default 'pending', -- pending | completed | rescheduled
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
create index if not exists owner_followups_owner_idx on public.owner_followups (owner_email);

/* ---------------- Private notes (any entity) ---------------- */
create table if not exists public.owner_notes (
  id          uuid primary key default gen_random_uuid(),
  owner_email text not null,
  entity_type text not null,   -- lead | customer | booking | listing
  entity_id   text,            -- lead uuid, customer email, booking uuid, listing uuid
  entity_label text,
  note        text not null,
  created_at  timestamptz default now()
);
create index if not exists owner_notes_owner_idx on public.owner_notes (owner_email);
create index if not exists owner_notes_entity_idx on public.owner_notes (entity_type, entity_id);

/* ---------------- Analytics events (visits / actions) ---------------- */
create table if not exists public.listing_analytics_events (
  id           uuid primary key default gen_random_uuid(),
  owner_email  text,            -- owner of the listing the event is about
  listing_id   uuid,
  service_type text,            -- hotels | homestays | tours | transport | guides | photographers | restaurants | roadside | coworking | ...
  event_type   text not null,   -- profile_view | listing_view | whatsapp_click | phone_click | message_click | booking_request_click | wishlist_save | wishlist_remove | map_click | review_click | share_click
  visitor_id   text,            -- anonymous device id (localStorage), never PII
  user_email   text,            -- only if signed in; used for unique/repeat counts, not displayed as contact
  device_type  text,            -- mobile | tablet | desktop
  city         text,
  country      text,
  referrer     text,
  created_at   timestamptz default now()
);
create index if not exists lae_owner_idx on public.listing_analytics_events (owner_email);
create index if not exists lae_listing_idx on public.listing_analytics_events (listing_id);
create index if not exists lae_event_idx on public.listing_analytics_events (event_type);
create index if not exists lae_created_idx on public.listing_analytics_events (created_at);

/* ============================================================
 * RLS
 * ============================================================ */

-- CRM tables: an owner sees/manages only their own rows; admins everything.
do $$
declare t text; pol record;
begin
  foreach t in array array['owner_leads','owner_followups','owner_notes'] loop
    execute format('alter table public.%I enable row level security', t);
    for pol in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;
    execute format($f$create policy "crm_read" on public.%I for select
      using (owner_email = auth.email() or public.is_admin())$f$, t);
    execute format($f$create policy "crm_insert" on public.%I for insert
      with check (owner_email = auth.email() or public.is_admin())$f$, t);
    execute format($f$create policy "crm_update" on public.%I for update
      using (owner_email = auth.email() or public.is_admin())
      with check (owner_email = auth.email() or public.is_admin())$f$, t);
    execute format($f$create policy "crm_delete" on public.%I for delete
      using (owner_email = auth.email() or public.is_admin())$f$, t);
  end loop;
end $$;

-- Analytics events: anyone (incl. anonymous visitors) may LOG an event; only the
-- listing owner or an admin may READ them. No update/delete for the public.
do $$
declare pol record;
begin
  execute 'alter table public.listing_analytics_events enable row level security';
  for pol in select policyname from pg_policies where schemaname='public' and tablename='listing_analytics_events' loop
    execute format('drop policy if exists %I on public.listing_analytics_events', pol.policyname);
  end loop;
  create policy "lae_insert" on public.listing_analytics_events for insert with check (true);
  create policy "lae_read" on public.listing_analytics_events for select
    using (owner_email = auth.email() or public.is_admin());
  create policy "lae_delete" on public.listing_analytics_events for delete
    using (public.is_admin());
end $$;
