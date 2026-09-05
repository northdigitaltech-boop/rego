/* ============================================================
 * phase103 — look up an avatar without being able to harvest emails
 *
 * ADDITIVE. Creates one function. The existing view is left in
 * place so nothing breaks before the app is deployed; dropping it
 * is section 3, to be run afterwards.
 *
 * ---------------------------------------------------------------------------
 * WHAT SUPABASE'S ADVISOR SAYS, AND WHAT IS ACTUALLY WRONG
 *
 * The advisor flags public.public_avatars as CRITICAL because it is a
 * SECURITY DEFINER view. That rule is blanket — every such view trips it —
 * and this one was deliberate. phase71 explains why: profiles is self-read
 * only, so a chat cannot show the other person's picture; a table policy would
 * expose role and business_category too, so a three-column view was created
 * instead.
 *
 * So the advisor's reason is not the problem. The problem is one phase71 got
 * wrong in its own comment:
 *
 *     "The narrow column list is what makes that acceptable: there is
 *      nothing sensitive left to leak."
 *
 * There is. The view returns id, email and avatar for EVERY profile, to ANY
 * signed-in user. The application only ever asks for emails it already knows —
 * `.in("email", missing)` — but the view does not require that. One
 * `select email from public_avatars` returns every address on the platform.
 * Twenty-six real people's email addresses today, and more with every signup.
 *
 * ---------------------------------------------------------------------------
 * THE FIX
 *
 * A function instead of a view. You cannot enumerate a function: it answers
 * for the emails you hand it and nothing else. Someone who already knows an
 * address learns whether it has an avatar, which is exactly what the chat
 * needs and no more.
 *
 * This does not make probing impossible — a caller can guess addresses and see
 * which come back. That is inherent to "look up by email" and is a rate-limit
 * question, not a schema one. What it removes is the bulk dump, which is the
 * part that matters.
 *
 * ROLLBACK: at the bottom.
 * ============================================================ */

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'public.profiles is missing — run phase29-auth-profiles.sql first.';
  end if;
end $$;


create or replace function public.avatars_for_emails(p_emails text[])
returns table (email text, avatar text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.email, p.avatar
    from public.profiles p
   where p.email is not null
     and p.avatar is not null
     /* The caller must already know the address. Lower-cased on both sides
        because the app normalises before asking and stored values may not
        be. */
     and lower(p.email) = any (
       select lower(e) from unnest(p_emails) as e where e is not null and e <> ''
     )
     /* A ceiling, so this cannot be turned into a dump by passing a
        generated list. Real use asks for the handful of people in one chat
        or booking list. */
   limit 200;
$$;

comment on function public.avatars_for_emails is
  'Avatars for addresses the caller already has. Replaces the public_avatars '
  'view, which returned every profile''s email to any signed-in user.';

revoke all on function public.avatars_for_emails(text[]) from public, anon;
grant execute on function public.avatars_for_emails(text[]) to authenticated;


/* Confirm it works and that the ceiling holds.
   The Supabase editor shows only the last result set, so this is last. */
select
  (select count(*) from public.avatars_for_emails(array['nobody@example.invalid']))  as unknown_address_returns,
  (select count(*) from public.profiles where email is not null)                     as profiles_total,
  (select count(*) from public.avatars_for_emails(
     array(select email from public.profiles where email is not null)))              as returned_for_all_known;


/* ============================================================
 * 2. AFTER THE APP IS DEPLOYED
 *
 * src/lib/avatars.ts calls the function first and falls back to the
 * view, so the view can stay until you are sure. Once the deploy is
 * live and chat avatars still appear, run section 3.
 * ============================================================ */


/* ============================================================
 * 3. REMOVE THE VIEW — run this last, on its own.
 *
 * This is what clears the advisor warning, and it is also what
 * actually stops the email dump. Until it runs, the view is still
 * there and still readable.
 * ============================================================ */
-- drop view if exists public.public_avatars;


/* ------------------------------------------------------------------
 * ROLLBACK of section 1
 * ------------------------------------------------------------------ */
-- drop function if exists public.avatars_for_emails(text[]);
--
-- If section 3 was run and the view is needed back:
-- create or replace view public.public_avatars as
--   select id, email, avatar from public.profiles;
-- alter view public.public_avatars set (security_invoker = off);
-- revoke all on public.public_avatars from anon, authenticated;
-- grant select on public.public_avatars to authenticated;
