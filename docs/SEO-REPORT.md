# REGO — SEO Implementation Report

**Site:** https://rego.services (non-www canonical) · **Date:** 3 October 2026 · **Stack:** Next.js 15 App Router + Supabase on Vercel

This report covers what was changed, what was checked, and what is still open. Scores are out of 10 and describe **what the code and live site support today**, not what they could become. Anything not checked against the live site or real data is marked **Not Verified**.

---

## 1. Scores at a glance

| Area | Score | Short reason |
|---|---|---|
| Canonical domain & redirects | 9 | Canonicals forced to non-www in code; www → non-www 301 confirmed live |
| Crawl control (robots, filters, pagination) | 8 | Private areas blocked; filter/search views noindex; blog pagination indexable |
| XML sitemap | 8 | Built from live data, image entries, honest lastmod, noindex pages excluded |
| Titles & meta descriptions | 8 | One brand mention per title, listing titles fit 60 chars, real descriptions |
| Structured data | 7 | Built from real fields only; Rich Results Test not run (**Not Verified**) |
| Listing indexability & quality | 6 | Clear index rule; but many listings are thin or have wrong locations |
| City + service pages | 7 | Exist only where a service is open; noindex until they have substance |
| Internal linking | 7 | Listing → hub, hub → siblings, blog → booking; footer social links still `#` |
| Destination pages | 6 | Server-rendered and real; only 7 destinations, admin-typed stay counts unchecked |
| Blog / content | 7 | Good topical coverage; overlaps booking pages for the same searches |
| Road status | 7 | Server-rendered, every report dated, stale reports demoted |
| AI answer engines (AEO/GEO) | 7 | Crawlers allowed, `llms.txt` lists real pages, verifiable company identity |
| Image SEO | 7 | Real photos only, image sitemap, gallery alt text |
| Core Web Vitals | — | **Not Verified** — no field data was checked in this work |
| Local / entity SEO | 6 | SECP-verifiable company in markup; no Google Business Profile or social profiles linked |
| Trust & honesty of on-page claims | 8 | No stock photos, fake counts or unearned "Top Rated"; one admin-typed count remains |

**Overall technical SEO: about 7.5 / 10.** The site is now technically sound and honest. What limits it is content depth per listing, the number of destinations, and off-site authority (links, reviews, Business Profile), which code cannot fix.

---

## 2. What was done

### Domain and canonicals
- `NEXT_PUBLIC_SITE_URL` was set to the **www** address while the host redirects www → non-www. Every canonical therefore pointed at a redirect. `canonicalOrigin()` now strips `www.` in code, so this cannot happen again whatever the setting says.
- Titles no longer repeat the brand ("… with REGO — Rego"): `brandedTitle()` adds "— Rego" only when the title doesn't already contain it.

### Listing pages (`/listings/[id]`)
- Real titles (≤ 60 characters), descriptions and self-canonicals built from each listing's own data.
- **Index rule:** name (3+ characters), a location, a real photo, and approved status. Description length is reported but does **not** block indexing; that rule was relaxed after a run on production data showed it hid real businesses.
- Location is read from every field the site actually displays (`location`, `route`, `pickup_location`, `areas`).
- Structured data:
  - LocalBusiness types only when there is a real address; TouristTrip or Service otherwise.
  - Never added: rating, review count, phone number, coordinates.
- "Explore more" links up to the matching city-service page and destination guide, each checked to exist.

### Photos and honest content
- Stock and placeholder images (picsum, loremflickr, pravatar…) are removed everywhere. A listing with no photo shows a "No photo yet" panel.
- Invented hotel amenities, rating breakdowns and marketing text are removed.
- The business profile photo is required on new registrations.
- Invented "120+ Stays / 98+ Stays" counts are removed from the code.
- **"Top Rated" is hidden on listings with no reviews.** It is an admin-set badge, and the live Skardu Explore Club page showed "Top Rated" next to "No reviews yet". It now appears automatically once the first review lands. Editorial badges (Editor's Choice, Best Value, New, Popular) are unchanged.

### City + service pages (`/destinations/[slug]/[service]`)
- A page 404s if that service is not open in that place. It is noindex unless it has listings or written content, and the sitemap uses the same test.
- It has a "More in {place}" sibling links section, Twitter cards, an Open Graph image fallback, and a visible breadcrumb matching the hidden one.
- Links to a destination guide appear only if that guide page exists.

### Destinations and dead links
- The footer (on every page) and the search suggestions linked to `/destinations/hunza`, `/deosai`, `/fairy-meadows`, `/khaplu` and `/shigar`, all of which 404'd. They now use only the 7 live destination slugs.
- `/destinations/hunza` now permanently redirects to `/destinations/hunza-valley`. Slugs with no real equivalent are not redirected.
- The homepage destinations are now rendered on the server from the database. Search engines previously saw a built-in list with dead links and invented counts.

### Blog
- A "Plan your trip" box links each article to the bookable pages it is about, e.g. "Hotels in Skardu" → `/destinations/skardu/hotels`. Matching uses the title and tags only, and every link is checked to resolve. "Gilgit-Baltistan" is not mistaken for Gilgit city.
- Pages 2+ are indexable and canonical to themselves. Pages past the end return a real 404.
- The index title is "Gilgit-Baltistan Travel Blog & News".
- Team bylines are marked up as an Organization, not a Person.
- A visible "Updated" date is shown when an article changed more than a day after publishing.

### Road status (`/roadside/updates`)
- Reports are rendered on the server, so the content is in the HTML.
- Each report shows its age; after 24 hours it carries a warning, and after 72 hours it is greyed and labelled "Last report".

### Sitemap
- Built from live data:
  - real destinations;
  - published blog posts;
  - approved listings with a real photo;
  - categories and rental types only when they have something in them.
- Image entries for listings (up to 5 each), destinations and blog covers. Image URLs are XML-escaped, because Next.js writes them raw.
- `lastmod` only where a real content date exists. Generation time was being stamped on static pages, which teaches Google to ignore `lastmod` everywhere.

### AI answer engines
- `llms.txt` now lists each real destination and the 30 latest articles with dates. It previously listed only section pages.
- The site's WebSite markup advertised `/listings?q=…` as its search URL, but the page ignored `q`. It now works.
- Unchanged and still in place:
  - AI crawlers are allowed;
  - the editorial policy is linked;
  - Organization markup carries the SECP CUIN and links to the public record.

### Accessibility and image text
- Gallery photos on activity, coworking, event and story pages now have descriptive alt text.
- Listing thumbnail buttons had no accessible name; they now do.
- Personal photos on `/connect` (solo travellers) were left without names on purpose.

### Other fixes made along the way
- Partner signups being saved as travellers: fixed, with a repair script for affected accounts.
- AdSense added with consent gating, plus `ads.txt` and the cookie policy update.

---

## 3. Still open — in order of impact

### Needs you (no code)
1. **Push the last commit** (`eb8d95d`, "Top Rated" fix).
2. **Vercel:** set `NEXT_PUBLIC_SITE_URL=https://rego.services` (no www). The code works around it already, but the setting should be right.
3. **Search Console:** resubmit `sitemap.xml` after the push. Expect the page count to **fall** (photo-less listings and empty categories removed); that is intended.
4. **Rich Results Test** on one hotel, one tour package, one blog post and one destination page. **Not Verified** until this is done.
5. **Admin → Destinations:** the Hunza Valley page shows "120+ STAY AVAILABLE". This is typed text in the database. Correct it or clear it; when empty, nothing is shown.
6. **Listing locations:** Skardu Explore Club's office is in Skardu, but its location field says Gilgit, so its title reads "Travel company in Gilgit". Ask providers to check their location.
7. **Providers with no photo:** these listings are not indexed. Ask them to upload one; they come back automatically.
8. **Blog title check:** "Top 10 Best Hotels in Skardu" should actually list 10 hotels, or the title should change.
9. **Google Business Profile** for the Skardu office. This is the single biggest local-search step and is outside the code.
10. **Supabase:** run `supabase/repair-partner-roles.sql` and `check-rls-state.sql`. Whether the public UPDATE/DELETE policies from phase 16 were closed in production is **Not Verified**.

### Small code follow-ups
- **Footer "Follow Us":** four social icons link to `#`. Replace them with real profile URLs, or remove them until the profiles exist. Once real, add them to the Organization `sameAs` list.
- **Footer app badges** ("Google Play" / "App Store") link to `#`. They are labelled "Coming Soon", but a dead link is still a dead link; render them as plain text until the apps exist.
- **Fairy Meadows:** there is a blog article at `/blog-news/fairy-meadows` but no destination page. Either create the destination in the admin or link the footer to the article.
- A generic site-wide `meta keywords` tag appears on every page. Google ignores it, so this is harmless, but it is the same on every page.
- `location_id` is not set on many older listings, so they get no "Hotels in Skardu"-style up-links. Backfilling it in the admin (Area picker) turns those links on.
- Pre-existing lint errors: unused `Star` in the activities and coworking pages, unused `Link` in the roadside provider profile. Not introduced by this work; left as they were.

### Not Verified in this work
- Core Web Vitals (LCP, INP, CLS) from real users — check Search Console → Core Web Vitals or PageSpeed Insights.
- Whether the dedicated routes (`/activities/[id]`, `/events/[id]`, `/coworking/[id]` …) apply the same photo/location index rule as `/listings/[id]`. Their sitemap entries were not filtered.
- Rich result eligibility (see item 4 above).

---

## 4. Rules this work followed

- No invented reviews, ratings, prices, addresses, phone numbers, coordinates, counts or road conditions. Where data was missing, the page says so or omits the field.
- No doorway pages: a city + service page exists only when that service is open there, and is indexed only when it has substance.
- Every internal link added is checked to resolve before it is rendered.
- No database schema changes, no package installs, no changes to booking, auth or dashboards beyond removing stock-image fallbacks.

---

## 5. Commits (this SEO pass)

| Commit | Change |
|---|---|
| `af3c984` | Canonical origin: strip www |
| `af7ad62` | One brand mention per title; related-services links; Twitter cards on city pages |
| `fe657d4` `66994a4` `aad20f1` | Listing titles, descriptions, canonicals and index rule (relaxed after production check; all location fields) |
| `5f0887e` | Listing structured data from real fields only; escaped category FAQ |
| `2a5c3f2` | Road status server-rendered with freshness |
| `8431e15` `0486878` | Listing → hub links; dead destination links; server-rendered homepage destinations; invented counts removed |
| `2bf5e11` | Blog → booking links, indexable pagination, Organization bylines, matching breadcrumbs |
| `9da809d` | `llms.txt` lists real pages; `/listings?q=` works; visible "Updated" date |
| `00fce3a` | Image sitemap; photo-less listings out of the sitemap; gallery alt text |
| `302feee` | Honest `lastmod`; empty categories and rental types out of the sitemap; empty rental types noindex |
| `eb8d95d` | "Top Rated" hidden without reviews |
