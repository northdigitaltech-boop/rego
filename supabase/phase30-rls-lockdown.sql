-- ============================================================
-- SAFARIGB — Phase 30: RLS lockdown (the real access control)
-- Replaces the permissive using(true) policies with owner / customer / admin
-- rules. Ownership is keyed on auth.email() = owner_email / customer_email;
-- admins are identified by public.is_admin() (from phase29).
--
-- PREREQUISITES: phase29 (profiles + is_admin) run, app on Supabase Auth.
-- SAFETY: run section by section and test the app after each. A rollback
-- block (re-grant permissive policies) is at the very bottom — uncomment the
-- section you need if something breaks.
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

-- ---------- 1. LISTING TABLES ----------
-- Public can read only approved rows. Owners read/manage only their own rows
-- (incl. pending/rejected, for their dashboards). Admins do everything.
do $$
declare t text; pol record;
begin
  foreach t in array array[
    'hotels','homestays','tour_companies','tour_packages','transports','tour_guides',
    'media_providers','restaurants','transport_providers','transport_services','rental_vehicles'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;
    execute format($f$create policy "p_read" on public.%I for select
      using (status = 'approved' or owner_email = auth.email() or public.is_admin())$f$, t);
    execute format($f$create policy "p_insert" on public.%I for insert
      with check (owner_email = auth.email() or public.is_admin())$f$, t);
    execute format($f$create policy "p_update" on public.%I for update
      using (owner_email = auth.email() or public.is_admin())
      with check (owner_email = auth.email() or public.is_admin())$f$, t);
    execute format($f$create policy "p_delete" on public.%I for delete
      using (owner_email = auth.email() or public.is_admin())$f$, t);
  end loop;
end $$;

-- ---------- 2. BOOKING TABLES ----------
-- Customer sees/creates/updates their own bookings (incl. submitting payment
-- proof). Owner sees/updates bookings for their listings (accept/reject).
-- Admin does everything.
do $$
declare t text; pol record;
begin
  foreach t in array array[
    'bookings','homestay_bookings','tour_bookings','transport_bookings',
    'guide_bookings','media_bookings','restaurant_bookings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;
    execute format($f$create policy "b_read" on public.%I for select
      using (customer_email = auth.email() or owner_email = auth.email() or public.is_admin())$f$, t);
    execute format($f$create policy "b_insert" on public.%I for insert
      with check (customer_email = auth.email() or public.is_admin())$f$, t);
    execute format($f$create policy "b_update" on public.%I for update
      using (customer_email = auth.email() or owner_email = auth.email() or public.is_admin())
      with check (customer_email = auth.email() or owner_email = auth.email() or public.is_admin())$f$, t);
    execute format($f$create policy "b_delete" on public.%I for delete
      using (owner_email = auth.email() or public.is_admin())$f$, t);
  end loop;
end $$;

-- ---------- 3. MESSAGES ----------
-- Interim: must be signed in to read; can only post as yourself. (Anonymous
-- access removed. Full per-thread restriction needs a participants table —
-- tracked as a follow-up because admin↔owner thread ids are hashed.)
do $$
declare pol record;
begin
  execute 'alter table public.messages enable row level security';
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'messages' loop
    execute format('drop policy if exists %I on public.messages', pol.policyname);
  end loop;
  create policy "m_read"   on public.messages for select using (auth.uid() is not null);
  create policy "m_insert" on public.messages for insert with check (sender_email = auth.email());
end $$;

-- ---------- 4. STORAGE: payment proofs ----------
-- Only signed-in users may read (sign) or upload proofs. (Removes the anon
-- read that phase27 left in place.)
do $$
begin
  drop policy if exists "payment_proofs_read" on storage.objects;
  drop policy if exists "payment_proofs_insert" on storage.objects;
  create policy "payment_proofs_read" on storage.objects
    for select using (bucket_id = 'payment-proofs' and auth.uid() is not null);
  create policy "payment_proofs_insert" on storage.objects
    for insert with check (bucket_id = 'payment-proofs' and auth.uid() is not null);
end $$;

-- ============================================================
-- ROLLBACK (uncomment a block and run if a section breaks the app)
-- ============================================================
-- -- Listing tables back to permissive:
-- do $$
-- declare t text; pol record;
-- begin
--   foreach t in array array['hotels','homestays','tour_companies','tour_packages','transports','tour_guides','media_providers','restaurants','transport_providers','transport_services','rental_vehicles'] loop
--     for pol in select policyname from pg_policies where schemaname='public' and tablename=t loop
--       execute format('drop policy if exists %I on public.%I', pol.policyname, t);
--     end loop;
--     execute format('create policy "open_all" on public.%I for all using (true) with check (true)', t);
--   end loop;
-- end $$;
-- -- Booking tables back to permissive: (same loop with the booking table list)
-- -- Messages back to permissive:
-- --   drop policy if exists "m_read" on public.messages; drop policy if exists "m_insert" on public.messages;
-- --   create policy "open_all" on public.messages for all using (true) with check (true);
