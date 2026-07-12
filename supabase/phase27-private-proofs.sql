-- ============================================================
-- SAFARIGB — Phase 27: Make payment proofs private
-- Payment screenshots are financial/PII. This flips the bucket to PRIVATE so
-- there are no permanent public URLs; the app serves them via short-lived
-- signed URLs instead.
--
-- NOTE: with the current anon-key model the SELECT policy still allows signed
-- URLs to be generated with the anon key (so owners/admin can view proofs).
-- Once real Supabase Auth lands, tighten "payment_proofs_read" to the booking
-- owner / admin only (auth.uid()-based) for full confidentiality.
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

-- 1) Private bucket (no public URLs).
update storage.buckets set public = false where id = 'payment-proofs';

-- 2) Ensure policies exist (idempotent). INSERT lets customers upload; SELECT is
--    required so the app can create signed URLs with the anon key.
do $$
begin
  begin
    create policy "payment_proofs_insert" on storage.objects
      for insert with check (bucket_id = 'payment-proofs');
  exception when duplicate_object then null; end;

  begin
    create policy "payment_proofs_read" on storage.objects
      for select using (bucket_id = 'payment-proofs');
  exception when duplicate_object then null; end;
end $$;

-- 3) Remove any public UPDATE policy on proofs (uploads should be write-once).
drop policy if exists "payment_proofs_update" on storage.objects;
