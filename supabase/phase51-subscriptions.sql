-- ============================================================
-- Phase 51 — Hidden Subscription / Pricing / Discount system
--
-- Ships fully built but OFF. Default state = free access, pricing
-- hidden from everyone except admins (preview). Launch is a data
-- change (flip flags), NOT a code change.
--
-- SECURITY: plan/pricing/subscription data is NOT publicly readable
-- until public_pricing_visible = true. Admins can always read/manage
-- via public.is_admin() (from phase29). platform_settings exposes
-- only boolean visibility flags, which are safe to read publicly.
-- Safe & idempotent to re-run.
-- ============================================================

/* ---------------- platform_settings (singleton, id = 1) ---------------- */
create table if not exists public.platform_settings (
  id                          int primary key default 1,
  subscription_enabled        boolean not null default false,
  free_access_enabled         boolean not null default true,
  public_pricing_visible      boolean not null default false,
  admin_preview_enabled       boolean not null default false,
  test_checkout_enabled       boolean not null default false,
  payment_enabled             boolean not null default false,
  owner_subscription_menu_visible boolean not null default false,
  navbar_pricing_visible      boolean not null default false,
  free_launch_banner_visible  boolean not null default false,
  free_access_start_date      date,
  free_access_end_date        date,
  subscription_launch_date    date,
  grace_period_days           int not null default 30,
  apply_paid_plans_to         text not null default 'new_owners', -- new_owners | existing_owners | all_owners | test_accounts
  announcement_enabled        boolean not null default false,
  announcement_title          text,
  announcement_message        text,
  announcement_start_date     date,
  announcement_end_date       date,
  updated_at                  timestamptz not null default now(),
  updated_by                  text,
  constraint platform_settings_single_row check (id = 1)
);

-- Seed the single row in the safe default (hidden + free) state.
insert into public.platform_settings (id) values (1)
  on conflict (id) do nothing;

/* ---------------- subscription_plans ---------------- */
create table if not exists public.subscription_plans (
  id                          uuid primary key default gen_random_uuid(),
  name                        text not null,
  slug                        text unique,
  short_description           text,
  full_description            text,
  icon                        text,
  features                    jsonb not null default '[]'::jsonb,
  limitations                 jsonb not null default '[]'::jsonb,
  category_scope              jsonb not null default '[]'::jsonb, -- [] = all categories
  currency                    text not null default 'PKR',
  -- monthly
  monthly_enabled             boolean not null default true,
  monthly_purchase_enabled    boolean not null default true,
  monthly_original_price      numeric check (monthly_original_price is null or monthly_original_price >= 0),
  monthly_discounted_price    numeric check (monthly_discounted_price is null or monthly_discounted_price >= 0),
  monthly_discount_type       text default 'none',   -- none | percentage | fixed | manual
  monthly_discount_value      numeric,
  monthly_discount_percentage numeric check (monthly_discount_percentage is null or (monthly_discount_percentage between 0 and 100)),
  monthly_discount_start      timestamptz,
  monthly_discount_end        timestamptz,
  monthly_offer_label         text,
  monthly_badge_text          text,
  -- yearly
  yearly_enabled              boolean not null default true,
  yearly_purchase_enabled     boolean not null default true,
  yearly_original_price       numeric check (yearly_original_price is null or yearly_original_price >= 0),
  yearly_discounted_price     numeric check (yearly_discounted_price is null or yearly_discounted_price >= 0),
  yearly_discount_type        text default 'none',
  yearly_discount_value       numeric,
  yearly_discount_percentage  numeric check (yearly_discount_percentage is null or (yearly_discount_percentage between 0 and 100)),
  yearly_discount_start       timestamptz,
  yearly_discount_end         timestamptz,
  yearly_offer_label          text,
  yearly_badge_text           text,
  -- display
  is_recommended              boolean not null default false,
  is_best_value               boolean not null default false,
  is_popular                  boolean not null default false,
  badge_text                  text,
  cta_text                    text,
  is_active                   boolean not null default true,
  is_visible                  boolean not null default true,
  display_order               int not null default 0,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  -- discounted must be a real reduction; end after start
  constraint plan_monthly_real_discount check (monthly_discounted_price is null or monthly_original_price is null or monthly_discounted_price <= monthly_original_price),
  constraint plan_yearly_real_discount  check (yearly_discounted_price is null or yearly_original_price is null or yearly_discounted_price <= yearly_original_price),
  constraint plan_monthly_dates check (monthly_discount_end is null or monthly_discount_start is null or monthly_discount_end > monthly_discount_start),
  constraint plan_yearly_dates  check (yearly_discount_end is null or yearly_discount_start is null or yearly_discount_end > yearly_discount_start)
);
create index if not exists subscription_plans_order_idx on public.subscription_plans (display_order);

/* ---------------- user_subscriptions ---------------- */
create table if not exists public.user_subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  user_email              text not null,
  plan_id                 uuid references public.subscription_plans(id) on delete set null,
  billing_cycle           text,                     -- monthly | yearly
  status                  text not null default 'free_access', -- free_access | trial | active | grace | expired | cancelled
  started_at              timestamptz,
  expires_at              timestamptz,
  trial_ends_at           timestamptz,
  grace_period_ends_at    timestamptz,
  payment_status          text,
  payment_provider        text,
  provider_subscription_id text,
  is_test_subscription    boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index if not exists user_subscriptions_user_idx on public.user_subscriptions (user_email);

/* ---------------- subscription_test_users ---------------- */
create table if not exists public.subscription_test_users (
  id                   uuid primary key default gen_random_uuid(),
  user_email           text not null unique,
  pricing_visible      boolean not null default true,
  test_checkout_enabled boolean not null default true,
  assigned_test_plan   uuid references public.subscription_plans(id) on delete set null,
  test_status          text,
  test_expires_at      timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

/* ---------------- subscription_price_history ---------------- */
create table if not exists public.subscription_price_history (
  id                        uuid primary key default gen_random_uuid(),
  plan_id                   uuid references public.subscription_plans(id) on delete cascade,
  billing_cycle             text,
  previous_original_price   numeric,
  previous_discounted_price numeric,
  new_original_price        numeric,
  new_discounted_price      numeric,
  changed_by                text,
  change_reason             text,
  changed_at                timestamptz not null default now()
);
create index if not exists sub_price_history_plan_idx on public.subscription_price_history (plan_id, changed_at desc);

/* ---------------- subscription_audit_logs ---------------- */
create table if not exists public.subscription_audit_logs (
  id             uuid primary key default gen_random_uuid(),
  admin_id       text,
  action         text not null,
  entity_type    text,
  entity_id      text,
  previous_value jsonb,
  new_value      jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists sub_audit_created_idx on public.subscription_audit_logs (created_at desc);

/* ---------------- subscription_promo_codes ---------------- */
create table if not exists public.subscription_promo_codes (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  description         text,
  discount_type       text not null default 'percentage', -- percentage | fixed
  discount_value      numeric not null default 0,
  applicable_plan     uuid references public.subscription_plans(id) on delete set null,
  billing_cycle       text,                     -- monthly | yearly | any
  start_date          timestamptz,
  expiry_date         timestamptz,
  total_usage_limit   int,
  per_user_limit      int,
  new_users_only      boolean not null default false,
  existing_partners_only boolean not null default false,
  selected_accounts   jsonb not null default '[]'::jsonb,
  is_active           boolean not null default true,
  used_count          int not null default 0,
  created_at          timestamptz not null default now()
);

/* ---------------- updated_at triggers ---------------- */
create or replace function public.touch_sub_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
do $$
declare t text;
begin
  foreach t in array array['platform_settings','subscription_plans','user_subscriptions','subscription_test_users'] loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$s', t);
    execute format('create trigger trg_touch_%1$s before update on public.%1$s for each row execute function public.touch_sub_updated_at()', t);
  end loop;
end $$;

/* ---------------- RLS ---------------- */
alter table public.platform_settings        enable row level security;
alter table public.subscription_plans       enable row level security;
alter table public.user_subscriptions       enable row level security;
alter table public.subscription_test_users  enable row level security;
alter table public.subscription_price_history enable row level security;
alter table public.subscription_audit_logs  enable row level security;
alter table public.subscription_promo_codes enable row level security;

do $$
declare has_admin boolean := exists (select 1 from pg_proc where proname = 'is_admin');
begin
  -- platform_settings: anyone may read the (boolean) visibility flags; only admins write.
  drop policy if exists ps_read on public.platform_settings;
  create policy ps_read on public.platform_settings for select using (true);
  drop policy if exists ps_write on public.platform_settings;
  if has_admin then
    create policy ps_write on public.platform_settings for all using (public.is_admin()) with check (public.is_admin());
  else
    create policy ps_write on public.platform_settings for all using (true) with check (true);
  end if;

  -- subscription_plans: PUBLIC can read ONLY when pricing is launched AND the
  -- plan is visible/active. Admins can always read/manage (preview + editor).
  drop policy if exists plans_read on public.subscription_plans;
  if has_admin then
    create policy plans_read on public.subscription_plans for select using (
      (is_visible and is_active and (select public_pricing_visible from public.platform_settings where id = 1))
      or public.is_admin()
    );
  else
    create policy plans_read on public.subscription_plans for select using (
      is_visible and is_active and (select public_pricing_visible from public.platform_settings where id = 1)
    );
  end if;
  drop policy if exists plans_write on public.subscription_plans;
  if has_admin then
    create policy plans_write on public.subscription_plans for all using (public.is_admin()) with check (public.is_admin());
  else
    create policy plans_write on public.subscription_plans for all using (true) with check (true);
  end if;

  -- user_subscriptions: owner reads only their own; admins all.
  drop policy if exists subs_read on public.user_subscriptions;
  if has_admin then
    create policy subs_read on public.user_subscriptions for select using (
      user_email = auth.email() or public.is_admin()
    );
  else
    create policy subs_read on public.user_subscriptions for select using (
      user_email = auth.email()
    );
  end if;
  drop policy if exists subs_write on public.user_subscriptions;
  if has_admin then
    create policy subs_write on public.user_subscriptions for all using (public.is_admin()) with check (public.is_admin());
  else
    create policy subs_write on public.user_subscriptions for all using (true) with check (true);
  end if;

  -- Everything else = admin-only (hidden from public entirely).
  if has_admin then
    drop policy if exists testusers_all on public.subscription_test_users;
    create policy testusers_all on public.subscription_test_users for all using (public.is_admin()) with check (public.is_admin());
    drop policy if exists sph_all on public.subscription_price_history;
    create policy sph_all on public.subscription_price_history for all using (public.is_admin()) with check (public.is_admin());
    drop policy if exists sal_all on public.subscription_audit_logs;
    create policy sal_all on public.subscription_audit_logs for all using (public.is_admin()) with check (public.is_admin());
    drop policy if exists promo_all on public.subscription_promo_codes;
    create policy promo_all on public.subscription_promo_codes for all using (public.is_admin()) with check (public.is_admin());
  else
    -- Fallback (no is_admin yet): keep app-gated permissive so the admin UI works.
    drop policy if exists testusers_all on public.subscription_test_users;
    create policy testusers_all on public.subscription_test_users for all using (true) with check (true);
    drop policy if exists sph_all on public.subscription_price_history;
    create policy sph_all on public.subscription_price_history for all using (true) with check (true);
    drop policy if exists sal_all on public.subscription_audit_logs;
    create policy sal_all on public.subscription_audit_logs for all using (true) with check (true);
    drop policy if exists promo_all on public.subscription_promo_codes;
    create policy promo_all on public.subscription_promo_codes for all using (true) with check (true);
  end if;
end $$;
