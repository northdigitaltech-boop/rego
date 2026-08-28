# REGO — Keyword map

**Written:** 29 August 2026 · **Domain:** www.rego.services

---

## What the audit found

Most of what the brief asks for is already built. Listing it so nothing gets
built twice:

| Asked for | Already there |
|---|---|
| Central metadata helper | `src/lib/seo.ts` — `buildMetadata()`: canonical, OG, Twitter, robots |
| Canonical URLs | Every page; the layout-inheritance bug was fixed earlier |
| Schema | `src/components/seo/json-ld.tsx` — Organization, WebSite, BreadcrumbList, TouristDestination, FAQPage, Article, ItemList |
| Dynamic sitemap | `src/app/sitemap.ts` — reads the database, excludes admin/auth/dashboard |
| robots.txt | `src/app/robots.ts` |
| Service × destination pages | `/destinations/[slug]/[service]` — "Hotels in Skardu" etc. |
| Question-and-answer content (AEO) | `answers` table + `src/components/aeo/answer-blocks.tsx` |
| AI-crawler policy, `llms.txt` | `src/app/llms.txt/route.ts`, `src/lib/ai-crawlers.ts` |
| Editorial policy / E-E-A-T | `/editorial-policy`, SECP registration in the footer |
| Region-level service pages | `/categories/[slug]` — titled "Hotels & Resorts in Gilgit-Baltistan" etc. |

**The doorway-page guard already exists and is stricter than the brief.**
`/destinations/[slug]/[service]` returns **404** when the service is not
available in that area, and stays **noindex** until `decideIndexable()` sees
either real listings or real written content. `sitemap.ts` calls the same
function, so the two cannot disagree. That is thirteen districts × fourteen
services = 182 possible URLs, deliberately kept from existing until they
deserve to.

---

## The honest problem, before any of this matters

Search Console, last 90 days: **24 clicks, 544 impressions, average position
16.2**. Six impressions a day. The two queries appearing are `rego travel` and
`rego office` — brand queries, and the second is probably somebody looking for
something else.

That is not a metadata problem. The site has **1 blog post, 8 destinations and
about 15 listings**. Metadata decides how a page is described once Google has a
reason to show it; it does not create the reason.

Every keyword below is winnable. None of them are winnable this month, and the
work that wins them is writing and provider sign-ups, not tags. `SEO-CONTENT-PLAN.md`
has the schedule.

---

## Keyword → URL

Status is what is true **today**, not what is planned.

| # | Keyword | Target URL | Type | Intent | Title | H1 | Status |
|---|---|---|---|---|---|---|---|
| 1 | Gilgit Baltistan tourism marketplace | `/` | Primary | Navigational / discovery | REGO \| Gilgit Baltistan Tourism Marketplace & Travel Booking | Gilgit Baltistan Tourism Marketplace | **Done** — title fixed this pass |
| 14 | tourism marketplace Pakistan | `/` | Secondary | Discovery | as above | as above | **Done** — served by the same page |
| 15 | travel services marketplace Pakistan | `/` | Secondary | Discovery | as above | as above | **Done** |
| 2 | best travel booking site in Gilgit Baltistan | `/how-it-works` | Secondary | Comparison | How It Works — Rego | How Rego works | **Needs content** — page exists, thin |
| 3 | Gilgit Baltistan tour booking | `/listings` | Primary | Transactional | Browse all listings | — | **Needs an H1 and intro** |
| 4 | best tour companies in Gilgit Baltistan | `/categories/travel-companies` | Primary | Commercial | Travel Companies in Gilgit-Baltistan | Travel Companies | **Live, needs intro content** |
| 5 | best tour packages in Gilgit Baltistan | `/categories/tours` | Primary | Commercial | Tour Packages in Gilgit-Baltistan | Tour Packages | **Live, needs intro content** |
| 6 | best tour guides in Gilgit Baltistan | `/categories/guides` | Primary | Commercial | Tour Guides in Gilgit-Baltistan | Tour Guides | **Live, needs intro content** |
| 7 | hotels in Gilgit Baltistan | `/categories/hotels` | Primary | Commercial | Hotels & Resorts in Gilgit-Baltistan | Hotels & Resorts | **Live, needs intro content** |
| 8 | car rental in Gilgit Baltistan | `/categories/transport` | Primary | Commercial | Transport in Gilgit-Baltistan | Transport | **Live** — see note below |
| 9 | Skardu tour packages | `/destinations/skardu/tours` | Primary | Commercial | generated per location + service | Tour Packages in Skardu | **Route exists; indexed only when it has listings** |
| 10 | Hunza tour packages | `/destinations/hunza/tours` | Primary | Commercial | generated | Tour Packages in Hunza | **Route exists; same gate** |
| 11 | things to do in Gilgit Baltistan | `/activities` | Primary | Informational → commercial | Activities | — | **Needs an H1 and intro** |
| 12 | places to visit in Gilgit Baltistan | `/destinations` | Primary | Informational | Destinations | — | **Needs an H1 and intro** |
| 13 | Gilgit Baltistan travel guide | `/blog-news` cluster | Primary | Informational | per article | per article | **Not written** — one post exists |

### Long-tail, already routed

These need no new pages. The route exists and gates itself on having something
to show:

`hotels in Skardu` · `hotels in Hunza` · `car rental in Skardu` ·
`tour guide in Skardu` · `tour guide in Hunza` · `restaurants in Skardu`
→ `/destinations/{place}/{service}`

---

## Two decisions in this map worth stating plainly

**No new landing pages were created.** The brief asks for `/tour-packages/gilgit-baltistan`,
`/hotels/gilgit-baltistan` and so on. Those pages already exist as
`/categories/tours` and `/categories/hotels`, which the brief itself says to
preserve rather than replace (Phase 18). Creating a second URL for the same
listings would split the ranking between two pages and give Google a duplicate
to choose between — the opposite of the goal.

**"Car rental" has no page of its own, and should not get one yet.**
`/categories/transport` covers cars, jeeps and rentals together, and there are
two transport listings on the site. A dedicated `/car-rentals` page today
would have two cars on it. Worth splitting when there are enough vehicles to
fill it; not before.

---

## What actually moves these keywords

In order. The first item is worth more than everything below it combined.

1. **Listings.** Fifteen is not a marketplace. Every provider is a page, and
   every page is a reason for Google to show the category above it. It is also
   the difference between `/categories/hotels` ranking and `/categories/hotels`
   being a page with four hotels on it.

2. **Intro content on the eight commercial pages** above marked *needs intro*.
   Two or three paragraphs each, written by someone who knows the region —
   what to expect, what things cost, when to go. `location_seo` already stores
   this per location and per service, and the destination pages already render
   it. The category pages need the same block wiring in.

3. **The blog.** `SEO-CONTENT-PLAN.md` lists 25 posts with their target
   queries. `Gilgit Baltistan travel guide` (#13) cannot be won without them —
   there is no page to win it with.

4. **The Skardu answers.** Seven are drafted and held back pending
   verification (`phase88` prints what each needs). They feed both the FAQ
   schema and AI search.

---

## Not done, and why

| Brief asked for | Not done because |
|---|---|
| A landing page per keyword | Most already exist under different URLs; new ones would duplicate |
| `/gilgit-baltistan`, `/skardu` top-level routes | `/destinations/skardu` exists and has the links, the schema and the answers. A second URL for one place is a canonical problem, not a win |
| Hundreds of location × service pages | The codebase already refuses to generate these, on purpose |
| Review / AggregateRating schema | No genuine review data yet. Emitting it would be fabricated |
| Article schema on guides | Already implemented; waiting on articles |
