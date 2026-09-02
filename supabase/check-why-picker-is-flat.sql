/* ============================================================
 * READ-ONLY. Changes nothing.
 *
 * Answers: why does the provider form show ONE "Area" dropdown
 * instead of Region -> District -> Area?
 *
 * HOW THE PICKER DECIDES
 *   1. It reads public.locations with the signed-in user's own
 *      permissions. An admin sees every row; anyone else sees
 *      only rows whose OWN is_public is true, because the RLS
 *      read policy does not inherit.
 *   2. It calls areas_open_for_listings(service), which returns
 *      locations where is_active AND is_public AND
 *      listings_enabled all resolve true.
 *   3. It shows the intersection, and builds one dropdown per
 *      level. A location whose parent is NOT in that
 *      intersection becomes a root — so if districts are closed
 *      and areas are open, every area sits on the first row and
 *      the level is labelled "Area".
 *
 * THE DEFAULT THAT SURPRISES PEOPLE
 *   resolve_location_flag returns, when nothing is set anywhere
 *   up the tree:
 *       is_active  -> true
 *       is_public  -> true
 *       everything else, including listings_enabled -> FALSE
 *   So out of the box NO area is open to new listings, and the
 *   picker renders nothing at all. Something has to switch
 *   listings_enabled on.
 *
 * Change 'travel-companies' below to check another service:
 * hotels, homestays, hostels, tours, transport, guides,
 * photographers, restaurants, coworking, activities,
 * roadside, expeditions.
 * ============================================================ */

select
  repeat('    ', l.depth) || l.name        as location,
  l.location_type,

  /* The raw column: what an admin actually clicked. NULL = inherited. */
  l.listings_enabled                       as listings_column,

  /* What the rules resolve to, walking up the tree. */
  public.resolve_location_flag(l.id, 'is_active')                              as active,
  public.resolve_location_flag(l.id, 'is_public')                              as public_resolved,
  public.resolve_location_flag(l.id, 'listings_enabled', 'travel-companies')   as listings,

  /* Whether a traveller could read this row at all. Deliberately the RLS
     rule verbatim, not the resolved value — they disagree, on purpose. */
  (l.is_public is true and l.is_active is not false)                           as readable_by_public,

  /* In the picker's list for this service? */
  exists (
    select 1 from public.areas_open_for_listings('travel-companies') a
     where a.id = l.id
  )                                                                            as in_picker,

  /* THE ANSWER. A row that is in the picker while its parent is not is
     exactly why the dropdown is flat: it has nothing to hang under, so it
     becomes a top-level option. */
  case
    when l.parent_id is null then 'root'
    when not exists (
      select 1 from public.areas_open_for_listings('travel-companies') a
       where a.id = l.id
    ) then '-'
    when exists (
      select 1 from public.areas_open_for_listings('travel-companies') a
       where a.id = l.parent_id
    ) then 'nested under its parent'
    else 'ORPHAN -> shown as a top-level option'
  end                                                                          as picker_position

from public.locations l
order by l.path_slugs;


/* ------------------------------------------------------------------
 * WHAT TO DO WITH THE ANSWER
 *
 * • Every row `in_picker = false`  → nothing has switched
 *   listings_enabled on. In Market & Area Management, select
 *   Gilgit-Baltistan and set "New listings" to On. It inherits
 *   downwards, so every division, district and area below opens
 *   with it, and the dropdowns become
 *   Region -> Division -> District -> Area.
 *
 *   SET IT ON GILGIT-BALTISTAN, NOT ON PAKISTAN. Pakistan is the
 *   parent of Khyber Pakhtunkhwa and Azad Jammu & Kashmir too, so
 *   switching it on there opens all three — and providers would be
 *   able to list in regions that are supposed to be invisible.
 *   Verified: setting it at the country level returns KPK and its
 *   divisions in the picker.
 *
 * • Areas say ORPHAN while their districts say '-'  → listings
 *   were switched on further down than intended. Set "New
 *   listings" to On at the region or division level and reset the
 *   individual areas to Inherit, and the dropdowns will nest.
 *
 * • readable_by_public = false everywhere  → expected today, and
 *   separate from the picker. It only matters for travellers, and
 *   it does NOT inherit: each area a traveller should reach needs
 *   its own explicit "Visible on website" = On.
 * ------------------------------------------------------------------ */
