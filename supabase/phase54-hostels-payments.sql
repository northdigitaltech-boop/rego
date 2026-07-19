-- ============================================================
-- REGO — Phase 54: Payment columns for the hostels module
-- The `hostels` and `hostel_bookings` tables were created in phase48, AFTER
-- phase26-payments.sql ran its loops over the then-existing tables — so they
-- never received the payment-configuration / payment-detail columns.
-- The public hostels query selects `accept_pay_at_property` (and siblings),
-- which fails at runtime with:
--   "column hostels.accept_pay_at_property does not exist"
-- and makes getHostels() return an empty list.
--
-- This migration adds the missing columns to both hostel tables, matching the
-- exact definitions used by every other listing/booking table in phase26.
-- Safe to run multiple times (add column if not exists).
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

-- ---------- 1. Payment-configuration + account details on `hostels` ----------
alter table public.hostels add column if not exists accept_pay_at_property boolean default true;
alter table public.hostels add column if not exists require_advance_payment boolean default false;
alter table public.hostels add column if not exists advance_payment_percentage numeric default 0;
alter table public.hostels add column if not exists accepted_payment_methods text[]
  default array['pay_at_property','bank_transfer','jazzcash','easypaisa']::text[];
alter table public.hostels add column if not exists payment_bank_name text;
alter table public.hostels add column if not exists payment_account_title text;
alter table public.hostels add column if not exists payment_account_number text;
alter table public.hostels add column if not exists payment_iban text;
alter table public.hostels add column if not exists payment_jazzcash text;
alter table public.hostels add column if not exists payment_easypaisa text;
alter table public.hostels add column if not exists payment_instructions text;

-- ---------- 2. Payment fields on `hostel_bookings` ----------
alter table public.hostel_bookings add column if not exists payment_method text;
alter table public.hostel_bookings add column if not exists payment_status text default 'unpaid';
alter table public.hostel_bookings add column if not exists total_amount numeric default 0;
alter table public.hostel_bookings add column if not exists advance_amount numeric default 0;
alter table public.hostel_bookings add column if not exists remaining_amount numeric default 0;
alter table public.hostel_bookings add column if not exists transaction_reference text;
alter table public.hostel_bookings add column if not exists payment_screenshot_url text;
alter table public.hostel_bookings add column if not exists paid_at timestamptz;
alter table public.hostel_bookings add column if not exists verified_by_admin boolean default false;
alter table public.hostel_bookings add column if not exists admin_payment_note text;
alter table public.hostel_bookings add column if not exists advance_payment_required boolean default false;
alter table public.hostel_bookings add column if not exists advance_payment_percentage numeric default 0;
