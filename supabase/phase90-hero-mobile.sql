-- ============================================================================
-- phase90 — a separate hero image for phones
-- ============================================================================
--
-- WHY
--   The hero is a wide landscape photograph. A phone viewport is tall and
--   narrow, so it can only show a vertical slice of one — most of the frame,
--   and usually the part that made the photo worth choosing, is cropped away.
--   A portrait image chosen for that shape is a different picture, not a
--   smaller version of the same one, which is why this is a column and not a
--   transformation.
--
-- FALLS BACK
--   Empty means phones keep getting the desktop hero, exactly as now. Nothing
--   changes until somebody sets one.
--
-- Depends on phase89, which added the desktop hero columns.
--
-- ROLLBACK
--   See section 3.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Column
-- ----------------------------------------------------------------------------
alter table public.platform_settings
  add column if not exists hero_image_mobile_url text;

-- Same guard as the desktop URL: this value ends up in an <img src> on the
-- busiest page on the site.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'platform_settings_hero_mobile_url_https'
  ) then
    alter table public.platform_settings
      add constraint platform_settings_hero_mobile_url_https
      check (hero_image_mobile_url is null or hero_image_mobile_url ~* '^https://');
  end if;
end $$;

commit;


-- ----------------------------------------------------------------------------
-- 2. Check
-- ----------------------------------------------------------------------------
select
  id,
  hero_image_url        as desktop,
  hero_image_mobile_url as mobile,
  hero_image_alt        as alt,
  hero_updated_at
from public.platform_settings
where id = 1;


-- ============================================================================
-- 3. ROLLBACK
-- ============================================================================
-- Phones go back to the desktop hero on the next render — the code already
-- falls back whenever this value is missing, including when the column is.
--
-- begin;
--   alter table public.platform_settings
--     drop constraint if exists platform_settings_hero_mobile_url_https;
--   alter table public.platform_settings
--     drop column if exists hero_image_mobile_url;
-- commit;
-- ============================================================================
