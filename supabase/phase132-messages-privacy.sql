-- ============================================================
-- phase132 — SEC-006. Booking conversations are private again.
--
-- ---------------------------------------------------------------------------
-- WHAT IS WRONG TODAY
--
-- phase30b:252 locked messages down like this:
--
--     create policy "m_read" on public.messages
--       for select using (auth.uid() is not null);
--
-- That is not a lock, it is a turnstile. It asks "are you signed
-- in?" and never asks "is this your conversation?". Any account
-- — a traveller who registered a minute ago — can read every
-- message ever exchanged between every traveller and every
-- provider on Rego, in one request, with the public anon key.
--
-- Booking chat is where people send phone numbers, hotel room
-- preferences, arrival times and "I'll be travelling alone".
--
-- phase112 spotted this exact policy and routed staff messaging
-- to its own table to avoid it. The hole in the original was
-- never closed.
--
-- ---------------------------------------------------------------------------
-- THE FIX, AND WHY IT IS SHAPED THIS WAY
--
-- messages has no recipient column — just booking_id and
-- sender_email. The other party is whoever else is on the
-- booking, so participation has to be resolved through
-- public.bookings.
--
-- The EXISTS below runs as the CALLING user, so bookings' own
-- RLS applies inside it. That is deliberate and it is the
-- strongest part of this policy: a booking the caller may not
-- read returns no row, so its messages are invisible without
-- this file having to restate who owns a booking. One rule,
-- enforced once, reused here.
--
-- INSERT IS TIGHTENED TOO
--   The old check was `sender_email = auth.email()`, which stops
--   impersonation but not intrusion: you could post into any
--   stranger's thread as yourself, as long as you knew a booking
--   id. Now you must also be on the booking.
--
-- NOTHING LEGITIMATE BREAKS
--   * src/lib/messages.ts reads by booking_id — a participant
--     still gets the whole thread.
--   * The inbox (getInboxThreads) selects across all messages;
--     it now returns only the caller's own conversations, which
--     is what an inbox was always supposed to mean.
--   * Admins keep full visibility via is_admin().
--   * Staff messaging is unaffected — phase112 gave it its own
--     table.
-- ---------------------------------------------------------------------------

/* ------------------------------------------------------------
   A cast that cannot throw.

   The first version of this file compared b.id to
   messages.booking_id directly, because phase6-chat.sql declares
   booking_id as `uuid references public.bookings(id)`. The live
   table does not match that declaration — Postgres rejected the
   policy with:

     42883: operator does not exist: uuid = text

   So one of the two columns is text. Rather than guess which,
   the block below reads the real types from the catalog and
   builds the comparison to fit. This helper is what makes the
   text side safe: a booking_id that is not a valid uuid becomes
   NULL instead of raising, so one malformed row cannot make
   every message in the table unreadable.
   ------------------------------------------------------------ */
create or replace function public.safe_uuid(p text)
  returns uuid
  language plpgsql
  immutable
  set search_path = public
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

do $$
declare
  pol       record;
  msg_type  text;
  bk_type   text;
  join_expr text;
begin
  if to_regclass('public.messages') is null then
    raise notice 'skipped — public.messages not present';
    return;
  end if;

  select data_type into msg_type from information_schema.columns
   where table_schema='public' and table_name='messages' and column_name='booking_id';
  select data_type into bk_type from information_schema.columns
   where table_schema='public' and table_name='bookings' and column_name='id';

  /* Prefer the form that keeps bookings' primary-key index usable: compare
     against b.id untouched and cast the other side. */
  if msg_type = bk_type then
    join_expr := 'b.id = messages.booking_id';
  elsif bk_type = 'uuid' then
    join_expr := 'b.id = public.safe_uuid(messages.booking_id::text)';
  else
    join_expr := 'b.id::text = messages.booking_id::text';
  end if;

  raise notice 'messages.booking_id is %, bookings.id is % -> using: %',
    msg_type, bk_type, join_expr;

  execute 'alter table public.messages enable row level security';

  for pol in select policyname from pg_policies
              where schemaname = 'public' and tablename = 'messages'
  loop
    execute format('drop policy if exists %I on public.messages', pol.policyname);
  end loop;

  /* Read: mine, my booking's, or admin.

     `to authenticated` matters here. Without it the policy is also evaluated
     for anon, and is_admin() is SECURITY DEFINER — the arrangement that turned
     ordinary reads into errors across 48 tables in phase110. Anonymous
     visitors have no auth.email() and no business in a booking thread. */
  execute format($p$
    create policy "m_read" on public.messages for select to authenticated
    using (
      sender_email = auth.email()
      or public.is_admin()
      or exists (
        select 1 from public.bookings b
         where %s
           and (b.customer_email = auth.email() or b.owner_email = auth.email())
      )
    )$p$, join_expr);

  /* Write: as yourself, into a conversation you are part of. */
  /* INSERT sees the new row's columns unqualified, so the same expression
     needs `messages.` dropped from it. */
  execute format($p$
    create policy "m_insert" on public.messages for insert to authenticated
    with check (
      sender_email = auth.email()
      and (
        public.is_admin()
        or exists (
          select 1 from public.bookings b
           where %s
             and (b.customer_email = auth.email() or b.owner_email = auth.email())
        )
      )
    )$p$, replace(join_expr, 'messages.', ''));

  /* No update and no delete policy, for anyone. A sent message is a record of
     what was agreed — a provider who could quietly edit "no refunds" into a
     thread after a dispute would make the whole log worthless as evidence.
     Admins act through the service role if a message must ever be removed. */

  raise notice 'messages: read and insert are now participant-scoped';
end $$;

-- ============================================================
-- VERIFY
--
--   select policyname, cmd, roles, qual
--     from pg_policies
--    where schemaname='public' and tablename='messages';
--
-- Expect exactly two rows, m_read (SELECT) and m_insert
-- (INSERT), both {authenticated}. Any policy containing
-- `auth.uid() IS NOT NULL` means this file did not take.
--
-- Then, signed in as an ordinary traveller, the sanity check
-- that matters:
--
--   select count(*) from public.messages;
--
-- Before this file that returned every message on Rego. It
-- should now return only the caller's own conversations.
-- ============================================================

-- ============================================================
-- ROLLBACK
--
-- Restores the turnstile. Only worth doing if a real flow is
-- blocked — and if one is, the better fix is to add that flow's
-- participants to the policy.
--
--   drop policy if exists "m_read"   on public.messages;
--   drop policy if exists "m_insert" on public.messages;
--   create policy "m_read"   on public.messages for select using (auth.uid() is not null);
--   create policy "m_insert" on public.messages for insert with check (sender_email = auth.email());
-- ============================================================
