-- ============================================================
-- Phase 50 — Smart Recommendations & Customer Notifications
-- Tables: notifications, notification_preferences, price_alerts,
--         promotions, price_history, notification_delivery_logs
-- Scoping follows the project's email-based pattern (user_email /
-- owner_email) with permissive RLS + app-layer filtering, matching
-- bookings/messages. Safe & idempotent to re-run.
-- ============================================================

/* ---------------- notifications ---------------- */
create table if not exists public.notifications (
  id                  uuid primary key default gen_random_uuid(),
  user_email          text not null,
  type                text not null,                 -- price_drop | deal | booking | availability | recommendation | road_alert | system
  category            text,                          -- hotels | transport | tours | activities | ...
  title               text not null,
  message             text,
  image_url           text,
  priority            text not null default 'informational', -- informational | promotional | important | urgent
  related_entity_type text,                          -- hotel | transport | package | activity | booking | ...
  related_entity_id   text,
  action_url          text,
  action_label        text,
  is_read             boolean not null default false,
  is_deleted          boolean not null default false,
  created_at          timestamptz not null default now(),
  expires_at          timestamptz
);
create index if not exists notifications_user_idx    on public.notifications (user_email);
create index if not exists notifications_unread_idx   on public.notifications (user_email, is_read) where not is_deleted;
create index if not exists notifications_created_idx  on public.notifications (created_at desc);

/* ---------------- notification_preferences (one row per user) ---------------- */
create table if not exists public.notification_preferences (
  user_email             text primary key,
  in_app_enabled         boolean not null default true,
  browser_push_enabled   boolean not null default false,
  email_enabled          boolean not null default false,
  sms_enabled            boolean not null default false,
  whatsapp_enabled       boolean not null default false,
  price_drop_enabled     boolean not null default true,
  deal_enabled           boolean not null default true,
  booking_enabled        boolean not null default true,
  availability_enabled   boolean not null default true,
  recommendation_enabled boolean not null default true,
  road_alert_enabled     boolean not null default true,
  promotional_paused     boolean not null default false,
  frequency              text not null default 'immediate', -- immediate | daily | weekly | important
  updated_at             timestamptz not null default now()
);

/* ---------------- price_alerts ---------------- */
create table if not exists public.price_alerts (
  id           uuid primary key default gen_random_uuid(),
  user_email   text not null,
  listing_id   text not null,
  listing_type text not null,                          -- hotel | transport | package | rental | activity | destination
  current_price numeric,
  target_price  numeric,
  alert_type    text not null default 'decrease',      -- decrease | target | availability | any_offer
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  triggered_at  timestamptz
);
create index if not exists price_alerts_user_idx    on public.price_alerts (user_email) where is_active;
create index if not exists price_alerts_listing_idx on public.price_alerts (listing_id, listing_type) where is_active;

/* ---------------- promotions (owner-created deals) ---------------- */
create table if not exists public.promotions (
  id                  uuid primary key default gen_random_uuid(),
  owner_email         text not null,
  listing_id          text,
  listing_type        text,                            -- hotel | transport | package | rental | activity
  title               text not null,
  description         text,
  original_price      numeric not null check (original_price >= 0),
  discounted_price    numeric not null check (discounted_price >= 0),
  discount_percentage numeric not null default 0 check (discount_percentage between 0 and 100),
  image_url           text,
  cta_label           text,
  terms               text,
  quantity            int,
  eligibility         text,
  start_date          date,
  end_date            date,
  status              text not null default 'draft',    -- draft | pending | scheduled | active | expired | rejected | paused
  approved_by         text,
  approved_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- Anti fake-discount guard: a discount must be a real reduction.
  constraint promo_real_discount check (discounted_price <= original_price)
);
create index if not exists promotions_owner_idx   on public.promotions (owner_email);
create index if not exists promotions_status_idx  on public.promotions (status);
create index if not exists promotions_listing_idx on public.promotions (listing_id, listing_type);
create index if not exists promotions_active_idx  on public.promotions (status, end_date) where status = 'active';

/* ---------------- price_history (audit trail for fake-discount checks) ---------------- */
create table if not exists public.price_history (
  id           uuid primary key default gen_random_uuid(),
  listing_id   text not null,
  listing_type text not null,
  old_price    numeric,
  new_price    numeric,
  changed_by   text,
  changed_at   timestamptz not null default now()
);
create index if not exists price_history_listing_idx on public.price_history (listing_id, listing_type, changed_at desc);

/* ---------------- notification_delivery_logs ---------------- */
create table if not exists public.notification_delivery_logs (
  id              uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications(id) on delete cascade,
  user_email      text,
  channel         text not null,                      -- in_app | push | email | sms | whatsapp
  status          text not null default 'queued',     -- queued | sent | delivered | failed | opened | clicked
  failure_reason  text,
  delivered_at    timestamptz,
  opened_at       timestamptz,
  clicked_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists ndl_notification_idx on public.notification_delivery_logs (notification_id);
create index if not exists ndl_user_idx         on public.notification_delivery_logs (user_email);

/* ---------------- RLS (permissive, app-gated — matches project pattern) ---------------- */
do $$
declare t text;
begin
  foreach t in array array[
    'notifications','notification_preferences','price_alerts',
    'promotions','price_history','notification_delivery_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "read %1$s" on public.%1$s', t);
    execute format('create policy "read %1$s" on public.%1$s for select using (true)', t);
    execute format('drop policy if exists "insert %1$s" on public.%1$s', t);
    execute format('create policy "insert %1$s" on public.%1$s for insert with check (true)', t);
    execute format('drop policy if exists "update %1$s" on public.%1$s', t);
    execute format('create policy "update %1$s" on public.%1$s for update using (true) with check (true)', t);
    execute format('drop policy if exists "delete %1$s" on public.%1$s', t);
    execute format('create policy "delete %1$s" on public.%1$s for delete using (true)', t);
  end loop;
end $$;

-- Keep promotions.updated_at fresh.
create or replace function public.touch_promotions_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_promotions_touch on public.promotions;
create trigger trg_promotions_touch before update on public.promotions
  for each row execute function public.touch_promotions_updated_at();
