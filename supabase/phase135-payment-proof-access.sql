-- ============================================================
-- phase135 — payment proofs stop being readable by everyone.
--
-- SEC-007 (P1).
--
-- ---------------------------------------------------------------------------
-- WHAT IS WRONG TODAY
--
-- phase30b:268 locked the private bucket like this:
--
--     create policy "payment_proofs_read" on storage.objects
--       for select using (bucket_id = 'payment-proofs'
--                         and auth.uid() is not null);
--
-- Same shape as the messages hole: it asks "are you signed in?"
-- and never "is this yours?". Any account — one created a minute
-- ago — can list and download every payment proof on Rego.
--
-- These are bank transfer slips. Account numbers, account holder
-- names, amounts, and often a phone number written on the
-- receipt. It is the most sensitive bucket on the platform and
-- it had the weakest rule.
--
-- ---------------------------------------------------------------------------
-- WHY THIS NEEDS A FUNCTION AND NOT JUST A POLICY
--
-- A storage policy can only see the object — its bucket and its
-- name. Proof paths look like `proofs/1789-a8f3k2.jpg`: no user
-- id, no booking id, nothing to match an owner against. So the
-- object alone cannot answer "may this person see it".
--
-- The answer lives in the booking row that references the file.
-- can_view_payment_proof() looks the path up across all eight
-- booking tables and checks whether the caller is the customer,
-- the provider, or an admin.
--
-- WHY THE EMAIL IS A PARAMETER
--   The API route calls this with the service role, which has no
--   auth.email() of its own. The route verifies the bearer token
--   against Supabase FIRST and passes the email it got back —
--   never one from the request body. Execute is granted only to
--   service_role, so a browser cannot call it with someone
--   else's address.
--
-- WHAT THIS CANNOT FIX
--   Rows whose payment_screenshot_url is a legacy PUBLIC URL
--   (http…) are not protected by anything here, because a public
--   URL is readable by anyone who has the link, signed in or
--   not. Those files need moving into this bucket. The query at
--   the bottom of this file counts how many there are.
-- ---------------------------------------------------------------------------

create or replace function public.can_view_payment_proof(
  p_path  text,
  p_email text
)
  returns boolean
  language plpgsql
  stable
  security definer
  set search_path = public
as $$
declare
  t     text;
  found boolean;
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if p_path is null or length(p_path) = 0 or v_email = '' then
    return false;
  end if;

  /* Admins see every proof — they arbitrate payment disputes, which is the
     whole reason the proof exists. */
  if exists (select 1 from public.profiles p where lower(p.email) = v_email and p.role = 'admin') then
    return true;
  end if;

  foreach t in array array[
    'bookings','guide_bookings','homestay_bookings','hostel_bookings',
    'media_bookings','restaurant_bookings','tour_bookings','transport_bookings'
  ] loop
    -- Skip a table that is not in this database rather than failing the lot.
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    execute format($q$
      select exists (
        select 1 from public.%I
         where payment_screenshot_url = $1
           and (lower(customer_email) = $2 or lower(owner_email) = $2)
      )$q$, t)
    into found
    using p_path, v_email;

    if found then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

revoke all on function public.can_view_payment_proof(text, text) from public, anon, authenticated;
grant execute on function public.can_view_payment_proof(text, text) to service_role;

comment on function public.can_view_payment_proof(text, text) is
  'True when the email belongs to the customer or provider on a booking that references this proof, or to an admin. Service role only — the caller must verify the email itself.';

-- ------------------------------------------------------------
-- Narrow the bucket.
--
-- Customers must still be able to UPLOAD a proof, so the insert
-- policy is untouched. Reads now go through /api/booking/proof,
-- which uses the service role and therefore bypasses RLS after
-- checking the function above.
--
-- The admin policy stays so the Supabase dashboard remains
-- usable for support.
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage.objects unavailable — skipped';
    return;
  end if;

  drop policy if exists "payment_proofs_read" on storage.objects;

  create policy "payment_proofs_read" on storage.objects
    for select to authenticated
    using (bucket_id = 'payment-proofs' and public.is_admin());

  raise notice 'payment-proofs: direct reads are now admin-only';
end $$;

-- ============================================================
-- HOW MANY PROOFS ARE STILL PUBLIC URLS?
--
-- These predate the private bucket and cannot be protected by
-- any policy — anyone with the link can open them. Worth
-- knowing the number before deciding whether to migrate them.
--
--   select 'bookings' as t, count(*) from public.bookings
--    where payment_screenshot_url like 'http%'
--   union all select 'tour_bookings', count(*) from public.tour_bookings
--    where payment_screenshot_url like 'http%'
--   union all select 'transport_bookings', count(*) from public.transport_bookings
--    where payment_screenshot_url like 'http%';
-- ============================================================

-- ============================================================
-- ROLLBACK
--
-- Re-opens every proof to every signed-in account. Only do this
-- if proof viewing breaks AND /api/booking/proof cannot be
-- deployed.
--
--   drop policy if exists "payment_proofs_read" on storage.objects;
--   create policy "payment_proofs_read" on storage.objects
--     for select using (bucket_id = 'payment-proofs' and auth.uid() is not null);
--   drop function if exists public.can_view_payment_proof(text, text);
-- ============================================================
