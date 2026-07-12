-- ============================================================
-- SAFARIGB — Phase 3: admin approval workflow for hotels
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

-- Add a status column: 'pending' | 'approved' | 'rejected'
alter table public.hotels
  add column if not exists status text not null default 'pending';

-- Keep the original sample hotels visible (they have no owner).
update public.hotels set status = 'approved' where owner_email is null;
