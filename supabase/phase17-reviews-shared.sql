-- ============================================================
-- SAFARIGB — Phase 17: shared reviews (hotels, homestays, tours)
-- Reviews originally referenced hotels(id). We drop that FK so the same
-- reviews table can store verified reviews for any item id (homestays,
-- tour packages, transport, guides). Reviews are still scoped per item id.
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

alter table public.reviews
  drop constraint if exists reviews_hotel_id_fkey;
