-- ============================================================
-- phase133 — a rate limiter that survives serverless.
--
-- SEC-P0-3.
--
-- ---------------------------------------------------------------------------
-- WHAT IS WRONG TODAY
--
-- src/lib/rate-limit.ts keeps its counters in a JavaScript Map.
-- Its own header says what that means, and rate-limit-guard.ts
-- repeats it: "On Vercel every cold start begins with an empty
-- map, so a distributed or slow-drip attack will often never
-- trip it."
--
-- That is not a small caveat. Vercel runs each request in a
-- lambda that may be brand new, and spreads load across many of
-- them. An attacker hitting /api/auth/reset-link a hundred times
-- can easily land on a hundred fresh instances, each seeing a
-- count of 1. Sixteen routes are wearing a limiter that, in
-- production, mostly does not fire.
--
-- Worse, the number is reported in the security centre — so the
-- dashboard says "nobody is abusing the API" when what it means
-- is "no single instance saw enough traffic to notice".
--
-- ---------------------------------------------------------------------------
-- WHY POSTGRES AND NOT REDIS
--
-- The usual answer is Upstash. It is a good answer, and it is
-- also a new vendor, a new account, new secrets in Vercel and a
-- new thing that can be down. REGO already has a shared,
-- transactional, always-on store that every API route is already
-- connected to.
--
-- One INSERT .. ON CONFLICT DO UPDATE is atomic, so two lambdas
-- incrementing the same bucket at the same instant cannot both
-- read 4 and both write 5. That is the only property a fixed
-- window limiter actually needs.
--
-- If REGO later outgrows this — tens of thousands of checks a
-- minute — swapping in Redis is a change inside one function,
-- because the interface stays rateLimit(key, limit, window).
--
-- SEMANTICS ARE UNCHANGED
--   Same fixed-window behaviour as the in-memory version, same
--   return shape. Routes keep working identically; they just
--   start counting across the whole deployment instead of one
--   instance.
--
-- SECURITY
--   No grants to anon or authenticated. Only the service role —
--   which is what every API route already uses — may call it. A
--   browser cannot inflate someone else's counter, and cannot
--   probe whether a key exists.
-- ---------------------------------------------------------------------------

create table if not exists public.rate_limit_hits (
  bucket       text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 0,
  primary key (bucket, window_start)
);

/* Cleanup scans by time, not by key. */
create index if not exists rate_limit_hits_window_idx
  on public.rate_limit_hits (window_start);

alter table public.rate_limit_hits enable row level security;
revoke all on public.rate_limit_hits from anon, authenticated;

-- No policies at all: with RLS on and no policy, the table is
-- unreachable except through the SECURITY DEFINER function below and
-- the service role. That is the intent.

create or replace function public.rate_limit_hit(
  p_key            text,
  p_limit          integer,
  p_window_seconds integer
)
  returns table (allowed boolean, remaining integer, retry_after integer)
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  win_s   integer := greatest(coalesce(p_window_seconds, 60), 1);
  lim     integer := greatest(coalesce(p_limit, 1), 1);
  /* Floor now() to the window. Every instance computes the same
     boundary from the database clock, which is the whole point — using
     each lambda's own clock would give them each their own window. */
  win     timestamptz := to_timestamp(floor(extract(epoch from now()) / win_s) * win_s);
  n       integer;
begin
  if p_key is null or length(p_key) = 0 or length(p_key) > 200 then
    -- Fail OPEN on a malformed key. A limiter that errors would take the
    -- route down with it, which is a worse outcome than not counting one
    -- request.
    return query select true, lim, 0;
    return;
  end if;

  /* Atomic. Two lambdas hitting this in the same millisecond serialise on
     the row lock, so neither can read a stale count. */
  insert into public.rate_limit_hits (bucket, window_start, hits)
  values (p_key, win, 1)
  on conflict (bucket, window_start)
    do update set hits = public.rate_limit_hits.hits + 1
  returning hits into n;

  /* Opportunistic cleanup — roughly 1 call in 1000 pays for it, so there
     is no cron to forget and no table that grows forever. */
  if random() < 0.001 then
    delete from public.rate_limit_hits where window_start < now() - interval '1 day';
  end if;

  if n > lim then
    return query
      select false,
             0,
             greatest(1, ceil(extract(epoch from (win + make_interval(secs => win_s)) - now()))::integer);
  else
    return query select true, lim - n, 0;
  end if;
end;
$$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

comment on function public.rate_limit_hit(text, integer, integer) is
  'Deployment-wide fixed-window rate limit. Service role only. Fails open on a malformed key.';

-- ============================================================
-- VERIFY
--
--   select * from public.rate_limit_hit('test:verify', 3, 60);  -- allowed, 2 left
--   select * from public.rate_limit_hit('test:verify', 3, 60);  -- allowed, 1 left
--   select * from public.rate_limit_hit('test:verify', 3, 60);  -- allowed, 0 left
--   select * from public.rate_limit_hit('test:verify', 3, 60);  -- BLOCKED
--   delete from public.rate_limit_hits where bucket = 'test:verify';
-- ============================================================

-- ============================================================
-- ROLLBACK
--
-- The application falls back to the in-memory limiter by itself
-- when this function is absent, so dropping it degrades rather
-- than breaks.
--
--   drop function if exists public.rate_limit_hit(text, integer, integer);
--   drop table if exists public.rate_limit_hits;
-- ============================================================
