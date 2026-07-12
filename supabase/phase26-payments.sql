-- ============================================================
-- SAFARIGB — Phase 26: Manual payment system (payment-ready)
-- Adds payment fields to every booking table, payment-configuration +
-- account fields to every listing/provider table, and a Supabase Storage
-- bucket for payment proofs. Does NOT change the existing booking workflow.
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

-- ---------- 1. Payment fields on ALL booking tables ----------
do $$
declare t text;
begin
  foreach t in array array[
    'bookings','homestay_bookings','tour_bookings','transport_bookings',
    'guide_bookings','media_bookings','restaurant_bookings'
  ] loop
    execute format('alter table public.%I add column if not exists payment_method text;', t);
    execute format('alter table public.%I add column if not exists payment_status text default ''unpaid'';', t);
    execute format('alter table public.%I add column if not exists total_amount numeric default 0;', t);
    execute format('alter table public.%I add column if not exists advance_amount numeric default 0;', t);
    execute format('alter table public.%I add column if not exists remaining_amount numeric default 0;', t);
    execute format('alter table public.%I add column if not exists transaction_reference text;', t);
    execute format('alter table public.%I add column if not exists payment_screenshot_url text;', t);
    execute format('alter table public.%I add column if not exists paid_at timestamptz;', t);
    execute format('alter table public.%I add column if not exists verified_by_admin boolean default false;', t);
    execute format('alter table public.%I add column if not exists admin_payment_note text;', t);
    execute format('alter table public.%I add column if not exists advance_payment_required boolean default false;', t);
    execute format('alter table public.%I add column if not exists advance_payment_percentage numeric default 0;', t);
  end loop;
end $$;

-- ---------- 2. Payment settings + account details on listing/provider tables ----------
do $$
declare t text;
begin
  foreach t in array array[
    'hotels','homestays','tour_packages','tour_companies','rental_vehicles',
    'transport_services','transport_providers','tour_guides','media_providers','restaurants'
  ] loop
    -- configuration
    execute format('alter table public.%I add column if not exists accept_pay_at_property boolean default true;', t);
    execute format('alter table public.%I add column if not exists require_advance_payment boolean default false;', t);
    execute format('alter table public.%I add column if not exists advance_payment_percentage numeric default 0;', t);
    execute format($f$alter table public.%I add column if not exists accepted_payment_methods text[] default array['pay_at_property','bank_transfer','jazzcash','easypaisa']::text[];$f$, t);
    -- payout / instruction details (shown to the customer)
    execute format('alter table public.%I add column if not exists payment_bank_name text;', t);
    execute format('alter table public.%I add column if not exists payment_account_title text;', t);
    execute format('alter table public.%I add column if not exists payment_account_number text;', t);
    execute format('alter table public.%I add column if not exists payment_iban text;', t);
    execute format('alter table public.%I add column if not exists payment_jazzcash text;', t);
    execute format('alter table public.%I add column if not exists payment_easypaisa text;', t);
    execute format('alter table public.%I add column if not exists payment_instructions text;', t);
  end loop;
end $$;

-- ---------- 3. Supabase Storage bucket for payment proofs ----------
-- Public-read bucket (so owners/admins can view proofs via URL). 5 MB limit,
-- images only. This matches the platform's current anon-key + permissive-RLS
-- setup; tighten with signed URLs once real Supabase Auth is added.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs', 'payment-proofs', true, 5242880,
  array['image/png','image/jpeg','image/jpg','image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Policies (idempotent): allow read + upload of payment proofs.
do $$
begin
  begin
    create policy "payment_proofs_read" on storage.objects
      for select using (bucket_id = 'payment-proofs');
  exception when duplicate_object then null; end;

  begin
    create policy "payment_proofs_insert" on storage.objects
      for insert with check (bucket_id = 'payment-proofs');
  exception when duplicate_object then null; end;

  begin
    create policy "payment_proofs_update" on storage.objects
      for update using (bucket_id = 'payment-proofs');
  exception when duplicate_object then null; end;
end $$;
