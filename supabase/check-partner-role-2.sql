-- ============================================================
-- Which of those Google accounts actually asked to be a partner.
--
-- Everything comes back as ONE table, so nothing hides in the
-- Messages tab. Read-only — this changes nothing.
-- ============================================================

with owners as (
  -- Anyone who has actually registered a business, whatever their role says.
  -- A traveller does not own a hotel; if an address is in here, that account
  -- is a provider regardless of what profiles.role claims.
  select lower(owner_email) as email, 'hotel' as kind
    from public.hotels where owner_email is not null
  union all
  select lower(owner_email), 'homestay'
    from public.homestays where owner_email is not null
  union all
  select lower(owner_email), 'tour company'
    from public.tour_companies where owner_email is not null
  union all
  select lower(owner_email), 'transport'
    from public.transport_providers where owner_email is not null
),
flagged as (
  select
    u.email,
    p.role                                            as stored_role,
    u.raw_user_meta_data->>'role'                     as asked_for,
    coalesce(
      p.business_category,
      u.raw_user_meta_data->>'business_category'
    )                                                 as category,
    coalesce(o.kinds, '')                             as owns,
    coalesce(u.raw_app_meta_data->>'provider','email') as signed_up_with,
    u.created_at
  from auth.users u
  join public.profiles p on p.id = u.id
  left join (
    select email, string_agg(distinct kind, ', ') as kinds
      from owners group by email
  ) o on o.email = lower(u.email)
  where lower(coalesce(p.role,'')) in ('customer','traveler')
)
select
  case
    when asked_for = 'partner' and owns <> '' then '1. BROKEN — asked partner, has a business'
    when asked_for = 'partner'                then '2. BROKEN — asked partner'
    when owns <> ''                           then '3. CHECK  — owns a business, role says traveller'
    else                                           '4. fine   — genuine traveller'
  end                     as verdict,
  email,
  stored_role,
  asked_for,
  category,
  owns,
  signed_up_with,
  created_at
from flagged
order by verdict, created_at desc;
