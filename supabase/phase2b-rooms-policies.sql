-- ============================================================
-- SAFARIGB — Phase 2b: allow providers to manage rooms
-- Run in: Supabase → SQL Editor → New query → Run
-- (Prototype rules — open writes. Locked down later with Auth.)
-- ============================================================

drop policy if exists "anyone insert rooms" on public.rooms;
create policy "anyone insert rooms"
  on public.rooms for insert with check (true);

drop policy if exists "anyone update rooms" on public.rooms;
create policy "anyone update rooms"
  on public.rooms for update using (true) with check (true);

drop policy if exists "anyone delete rooms" on public.rooms;
create policy "anyone delete rooms"
  on public.rooms for delete using (true);
