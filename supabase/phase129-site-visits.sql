-- ============================================================
-- phase129 — counting visitors, new and returning.
--
-- Two small tables and two functions. No personal data of any
-- kind: no IP address, no user agent, no email, no page path.
-- Only a random id the browser made up about itself, and the
-- dates it came back on.
--
-- ---------------------------------------------------------------------------
-- WHY THE BROWSER NEVER TOUCHES THE TABLES
--
-- The obvious build is an insert policy for anon and a select
-- policy for admins. That works, and it also means the anon key
-- — which is in the page source of every visit — can write
-- arbitrary rows into the table the traffic figures are read
-- from. Anyone could inflate them.
--
-- Instead: no grants to anon on either table at all. The browser
-- can call exactly one function, record_site_visit, which is
-- SECURITY DEFINER and writes one row for today under an id the
-- caller supplies. It cannot read, update, delete, backdate, or
-- see whether a visitor already existed. The worst it can do is
-- invent visitor ids, which is the irreducible floor for any
-- client-side analytics including Google's.
--
-- DATES ARE PAKISTAN TIME, NOT UTC
--   "How many visitors today" means the operator's today. In UTC
--   the day rolls over at 5am local, so the morning's visitors
--   would land on the previous day's number and nobody would
--   ever be able to explain why.
-- ---------------------------------------------------------------------------

/* One row per visitor, ever. `first_seen` is what makes a visitor "new"
   on exactly one day and returning on every day after — decided by the
   database on first contact, not by the browser, which could lie. */
create table if not exists public.site_visitors (
  visitor_id  uuid primary key,
  first_seen  date not null,
  last_seen   date not null,
  visit_days  integer not null default 1
);

/* One row per visitor per day they showed up. Presence is the whole
   record — deliberately not a page-view counter, because the browser
   calls this once a day and a `views` column would look like page views
   and be nothing of the sort. */
create table if not exists public.site_visit_days (
  visitor_id uuid not null references public.site_visitors (visitor_id) on delete cascade,
  visit_date date not null,
  primary key (visitor_id, visit_date)
);

create index if not exists site_visit_days_date_idx on public.site_visit_days (visit_date);
create index if not exists site_visitors_first_seen_idx on public.site_visitors (first_seen);

alter table public.site_visitors   enable row level security;
alter table public.site_visit_days enable row level security;

/* Admins read. Nobody else reads, ever — there is no anon policy and no
   grant, so the tables are invisible outside this file's functions.

   `to authenticated` is not decoration. A policy with no TO clause is also
   evaluated for anon, and is_admin() is a SECURITY DEFINER function that
   RAISES for anon rather than returning false — which would turn every
   anonymous query on this table into an error instead of an empty result.
   That exact mistake took down 48 tables in phase110. */
do $$
begin
  begin
    create policy "site_visitors_admin_read" on public.site_visitors
      for select to authenticated using (public.is_admin());
  exception when duplicate_object then null; end;
  begin
    create policy "site_visit_days_admin_read" on public.site_visit_days
      for select to authenticated using (public.is_admin());
  exception when duplicate_object then null; end;
end $$;

revoke all on public.site_visitors   from anon;
revoke all on public.site_visit_days from anon;

-- ------------------------------------------------------------
-- The only thing a browser may do.
-- ------------------------------------------------------------
create or replace function public.record_site_visit(p_visitor_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Karachi')::date;
begin
  if p_visitor_id is null then
    return;
  end if;

  insert into public.site_visitors (visitor_id, first_seen, last_seen, visit_days)
  values (p_visitor_id, today, today, 1)
  on conflict (visitor_id) do update
    /* greatest(), not just `today`: two tabs racing, or a clock skewed
       backwards, must never walk last_seen into the past. */
    set last_seen = greatest(site_visitors.last_seen, excluded.last_seen);

  /* The day row decides whether this was a new DAY for this visitor, which
     is the only thing visit_days should count. Doing it here rather than
     incrementing above means a visitor refreshing forty times still counts
     as one day. */
  insert into public.site_visit_days (visitor_id, visit_date)
  values (p_visitor_id, today)
  on conflict do nothing;

  if found then
    update public.site_visitors
       set visit_days = visit_days + 1
     where visitor_id = p_visitor_id
       and first_seen < today;
  end if;
end;
$$;

revoke all on function public.record_site_visit(uuid) from public;
grant execute on function public.record_site_visit(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- Reading the numbers. Admin only, enforced in the function
-- rather than left to whoever remembers to hide a tab.
-- ------------------------------------------------------------
create or replace function public.site_visit_summary(p_days integer default 30)
  returns table (
    day            date,
    new_visitors   integer,
    repeat_visitors integer,
    total_visitors integer
  )
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  days  integer := least(greatest(coalesce(p_days, 30), 1), 365);
  today date := (now() at time zone 'Asia/Karachi')::date;
begin
  -- Not "return empty": a silent empty result looks identical to "no
  -- traffic yet", and an operator would spend an afternoon on that.
  if not public.is_admin() then
    raise exception 'site_visit_summary is restricted to administrators';
  end if;

  return query
  select d.visit_date,
         count(*) filter (where v.first_seen = d.visit_date)::integer,
         count(*) filter (where v.first_seen < d.visit_date)::integer,
         count(*)::integer
    from public.site_visit_days d
    join public.site_visitors v on v.visitor_id = d.visitor_id
   where d.visit_date > today - days
   group by d.visit_date
   order by d.visit_date;
end;
$$;

revoke all on function public.site_visit_summary(integer) from public, anon;
grant execute on function public.site_visit_summary(integer) to authenticated;

comment on function public.record_site_visit(uuid) is
  'Records that a consented browser visited today. Write-only for anon: it cannot read, amend or backdate anything.';
comment on function public.site_visit_summary(integer) is
  'Daily new / returning / total visitors. Raises for non-admins.';

-- ============================================================
-- ROLLBACK
--
-- Drops the feature entirely. The visit history goes with it —
-- there is nowhere else it is kept — so export first if the
-- numbers matter:
--
--   select * from public.site_visit_days order by visit_date;
--
--   drop function if exists public.site_visit_summary(integer);
--   drop function if exists public.record_site_visit(uuid);
--   drop table if exists public.site_visit_days;
--   drop table if exists public.site_visitors;
-- ============================================================
