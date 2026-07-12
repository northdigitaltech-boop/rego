-- ============================================================
-- SAFARIGB — Phase 34: Roadside review rating aggregation
-- A customer can insert a review (phase32 policy: customer_email = auth.email())
-- but RLS does NOT let them update the provider row. This trigger keeps the
-- provider's rating + total_reviews in sync automatically, running with
-- definer rights so it can update roadside_providers regardless of who wrote
-- the review.
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

create or replace function public.roadside_recalc_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  pid := coalesce(new.provider_id, old.provider_id);
  if pid is null then
    return null;
  end if;
  update public.roadside_providers p set
    total_reviews = (
      select count(*) from public.roadside_reviews r where r.provider_id = pid
    ),
    rating = coalesce((
      select round(avg(r.rating)::numeric, 1)
      from public.roadside_reviews r
      where r.provider_id = pid
    ), 0)
  where p.id = pid;
  return null;
end;
$$;

drop trigger if exists roadside_reviews_recalc on public.roadside_reviews;
create trigger roadside_reviews_recalc
  after insert or update or delete on public.roadside_reviews
  for each row execute function public.roadside_recalc_rating();
