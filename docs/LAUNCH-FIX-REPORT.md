# REGO — Launch Review Fix Report

**Brief:** `rego-developer-fix-prompt.pdf` (review of 23 Nov 2026) · **Commits:** `9b412b2` → `e8d0f33` (10 commits, not yet pushed)

**How this was tested:**
- Type-check passes and lint shows nothing new on changed files.
- Unit tests were run for the airport matcher (8 cases).
- The price-review trigger was tested against the real phase111 and phase138 triggers in a local Postgres (8 cases).
- A local `next build` could not run in the sandbox: its `node_modules` was installed on Windows. Vercel's build is the build check.
- **Not done:** no visual check in a browser, at desktop or at 390 px. Every row below says **Code ✓ / visual pending** until someone clicks through the live site.

## Result per item

| Item | What was changed | Result |
|---|---|---|
| **P0-1** Install modal | `components/pwa/install-prompt.tsx` — the automatic appearance is removed; the card opens only from the footer **Install App** button. Step text was garbled because each word was laid out as a separate flex item; now plain text. | Code ✓ / visual pending |
| **P0-2** Inflated counts | New `lib/destination-counts.ts`. Homepage cards, `/destinations` and the destination hero now count live listings, using the same location rule as the listings page they open. Exact number, or nothing at zero. Admin-typed "120+" text is no longer shown anywhere public; the site-search no longer shows a count. `/destinations` description no longer lists Naran, Deosai or Fairy Meadows, which have no pages (Naran is also outside GB). | Code ✓ / visual pending |
| **P0-3** Booking flow | Dates, rooms and the start date are now checked **before** the sign-up redirect in all 8 booking widgets; stays require check-in and check-out. New `bookings/booking-terms.tsx` is shown above every **Book now**: you get a reference, the provider is emailed, nothing is charged now, plus the provider's own cancellation text and links to Terms, Booking and Cancellation policies. "Instant confirmation", "Best Price Guarantee", "24/7 Support", "Reach millions of travelers" and "instant payouts" were removed. The stay button after submit reads "Booking created ✓ — choose payment below". *Already present:* total price, booking reference, confirmation emails. | Code ✓ / visual pending |
| **P0-4** Flagship tour | `tour-item-detail.tsx` now shows the Itinerary section (or an honest empty state), departure dates, pickup and drop-off, group size and policies. Only ticked inclusions are shown (✓). Unticked flags no longer appear as ✕ "excluded". Saving a package from the dashboard requires an itinerary. **The tour's actual content must be written by the operator.** | Code ✓ / data pending |
| **P0-5** Data quality | `supabase/phase140-price-review.sql`: if a non-admin enters a price above 0 and under PKR 500, the listing goes back to pending for admin review, on insert or edit. Partner forms also ask "Is a zero missing?" first. `supabase/check-data-quality.sql` (read-only) lists low prices, the three typos, ALL-CAPS names, "19th-century" descriptions, suspicious and shared cover photos, and empty itineraries. **The fixes themselves are database content, for an admin to make.** | Code ✓ / data pending |
| **P0-6** Flight search | `airport-autocomplete.tsx` and `flight-search-widget.tsx`: typed or pasted text resolves to an airport on blur, on Enter, and on Search. "Islamabad" resolves to ISB and "Skardu" to KDU. Errors are inline and specific. Whether ISB→KDU then *returns fares* depends on the flight provider. | Code ✓ / live pending |
| **P1-1** Reviews | The "No reviews yet" pill is gone from cards. `Rating` renders nothing by default. "Top Rated"/"Most Reviewed" sorts and rating filters are hidden until real reviews exist. | Code ✓ |
| **P1-2** Empty sections | Past events are filtered out automatically. Curated tiles over empty Activities and Events rows are removed. Rentals, Activities and Restaurants homepage rows need 2+ live items. Safarnama strips appear only when there are more than 3 stories. Rego's own jobs carry a "Job at Rego" label. *Not done:* menu links to empty category pages remain; those pages are noindex. | Partial |
| **P1-3** Footer `#` links | Social icons render only for URLs set in `socialLinks` (`lib/site.ts`). The store badges were removed. No `href="#"` left in the layout. | Code ✓ |
| **P1-4** Images | Already in place: Cloudinary `f_auto,q_auto` (WebP/AVIF), resized per slot, lazy below the fold. Not changed. | Not re-measured |
| **P1-5** Price filter | Slider maximum = highest live price, so 0 listings are hidden at the default. Shows "N hidden by filters · Reset". | Code ✓ |
| **P1-6** Provider contact | New `listings/provider-contact.tsx` adds Call and WhatsApp buttons using the provider's own profile number. Applied to tour companies, media providers and restaurants. Hotels, homestays and hostels have no phone column, so nothing is shown for them yet. | Partial |
| **P1-7** Partner terms | New `auth/partner-terms-box.tsx` on the partner sign-up step shows registration (free), commission, listing fee, payouts and cancellation responsibility. Values come from `partnerTerms`; until those are filled in, it says "confirmed in writing before your listing goes live". Separately, legal pages were publishing `[LEGAL ENTITY NAME]`, `[PHONE / WHATSAPP]`, `[COURTS / JURISDICTION]` and the fee-schedule placeholder. These were filled from verified site data, and the courts line now reads "competent courts of Pakistan". | Code ✓ / owner input |
| **P2-1** Spacing | Not reproduced: the live footer already reads "© 2026 Rego" and "Registered with SECP". Likely a text-extraction artifact in the review. | No change |
| **P2-2** Dates | All date and time displays use `en-GB` (dd/mm/yyyy) across 54 files. Native date pickers follow the phone or browser language and cannot be forced from code. | Code ✓ |
| **P2-3** Trending | The row is renamed "Tour Packages — Trips from local operators listed on Rego". "Best Travel Companies" is now "Travel Companies". The Swat tour itself is the operator's listing. | Code ✓ |
| **P2-4** Copy sweep | Done for the claims above; the typos are data (see P0-5). | Partial |

## Owner inputs still open — [NEEDS OWNER INPUT]

1. **Partner terms:** commission %, listing fee, payout timing → `partnerTerms` in `src/lib/site.ts`.
2. **Social profiles:** Facebook, Instagram, YouTube, WhatsApp URLs → `socialLinks` in `src/lib/site.ts`.
3. **Registered office address:** the full SECP-registered address, if different from "Skardu, Gilgit Baltistan, Pakistan" (used in the legal pages).
4. **Jurisdiction:** confirm "competent courts of Pakistan" with your lawyer, or name a specific court.
5. **Female drivers:** the real day rate.
6. **Saizgar:** a real photo of the property.
7. **Byala Skardu:** a description that matches the chalets.
8. **Spellings:** confirm "Luckey Palace", "SHANGRILLA" and "Islamabd" with the owners.
9. **Skardu & Hunza 10 Days:** description, day-by-day itinerary, inclusions, departure dates and pickup point, written by the operator.
10. **Hotel, homestay and hostel phone/WhatsApp:** should these show on listings? This needs a column added and the owners' consent.
11. **App store links:** only when the apps exist.

## SQL to run in Supabase

1. `supabase/phase140-price-review.sql` — the low-price review trigger. Additive; rollback at the bottom.
2. `supabase/check-data-quality.sql` — read-only report; run one block at a time.

Also run these if not done already: `phase138-trusted-partner-auto-approve.sql` and `phase139-room-details.sql`.

## Regressions

- **Search, map, blog, weather strip:** none of their code paths changed.
- **Listings browser:** its filter logic changed, and it was type-checked only.

Re-test all of these on the live site after the push.
