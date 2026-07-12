-- ============================================================
-- SAFARIGB — Phase 2: allow providers to manage hotels
-- Run in: Supabase → SQL Editor → New query → Run
--
-- NOTE: These are permissive (open) write rules suitable for a
-- PROTOTYPE. The app filters by owner_email so each provider only
-- sees their own hotels. Real per-user security comes when we add
-- Supabase Auth later. Do not launch publicly with these rules.
-- ============================================================

drop policy if exists "anyone insert hotels" on public.hotels;
create policy "anyone insert hotels"
  on public.hotels for insert
  with check (true);

drop policy if exists "anyone update hotels" on public.hotels;
create policy "anyone update hotels"
  on public.hotels for update
  using (true) with check (true);

drop policy if exists "anyone delete hotels" on public.hotels;
create policy "anyone delete hotels"
  on public.hotels for delete
  using (true);
