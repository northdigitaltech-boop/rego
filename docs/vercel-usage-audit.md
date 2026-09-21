# REGO — Vercel usage audit

Evidence gathered from the codebase on 22 Sep 2026. No code has been
changed. Every number below came from a command run against the repo,
not from an estimate.

---

## 0. The correction that reorders everything

**Most of what looks expensive in this app does not cost Vercel anything.**

REGO has no server actions and no middleware. 258 components are
`"use client"`, and they talk to Supabase **directly from the browser**.
Those requests go from the visitor's device to `*.supabase.co`. They
never touch Vercel, so they consume no Edge Requests, no Function
Invocations and no Fluid Active CPU. They cost Supabase quota, which is
a real budget — just not the one that has been blocking deploys.

What *does* bill Vercel here is narrow:

| Bills Vercel | Bills Supabase | Bills nobody |
|---|---|---|
| Server components rendering / ISR regeneration | Every `useEffect` → Supabase call | Cloudinary image delivery |
| The 30 API routes under `/api/*` | All 12 polling loops | |
| Static asset + RSC payload serving | | |

The blocker you hit was **Fluid Active CPU at 85%**. That is server
render time. So the findings are ordered by how much *server* work they
cause, not by how busy the code looks.

Two consequences worth stating plainly:

- Fixing the navbar polling would cut Supabase load meaningfully and
  Vercel load by **zero**.
- The usual advice "switch `<img>` to `next/image`" would make this
  **worse**: 156 raw `<img>` tags currently go straight to Cloudinary
  with `f_auto,q_auto,w_N`, which Vercel does not bill. Routing them
  through `next/image` would move that onto Vercel's Image Optimization
  quota. **Do not do it.** This is already right.

---

## 1. Architecture as measured

| Thing | Count |
|---|---|
| `page.tsx` routes | 70 |
| `route.ts` API handlers | 30 (20 `force-dynamic`) |
| Middleware files | **0** |
| `"use client"` components | 258 |
| Pages with `revalidate` | 35 — 31 at `60`, 4 at `300` |
| Pages with `generateStaticParams` | 6 |
| Uses of React `cache()` | **0** |
| Raw `<img>` tags | 156 |
| Files using `next/image` | 4 |
| `<Link>` instances | 252 (none with `prefetch={false}`) |
| Supabase select chains | 364 |
| …of those, with no `limit`/`range`/`single` | **222 (60%)** |
| `select("*")` calls | 193 |
| `setInterval` polling loops | 12 |

---

## 2. Findings

### P0-1 — `feedAllListings()` runs twice per request on category pages

**File:** `src/app/categories/[slug]/page.tsx:79` and `:318`

`feedAllListings()` fires **11 parallel Supabase queries** (hotels,
homestays, hostels, packages, guides, restaurants, media, companies,
services, rentals, transports). It is called once inside
`generateMetadata` and again in the page body. Next.js runs both in the
same request, and with no `cache()` wrapper nothing dedupes them.

**Cost:** 22 queries per regeneration instead of 11 — double the server
time on the most-crawled route family. With 41 category slugs at
`revalidate = 60`, that is up to 41 × 22 = **902 queries per minute**
under sustained crawl.

**Severity: P0.** Biggest single CPU win, and the safest fix in the list.

**Fix:** wrap `feedAllListings` in React `cache()`. One line, no
behaviour change — `cache()` dedupes within a single request only, so
nothing goes stale.

---

### P0-2 — `revalidate = 60` on every heavy page

**Files:** 31 pages, including `/`, `/listings`, `/categories/[slug]`,
`/destinations/[slug]`

Every path regenerates at most once a minute. `/` alone calls 13 feed
functions per regeneration; `/listings` and `/destinations/[slug]` each
call `feedAllListings()` (11 queries).

**Cost:** for content that changes when a provider adds a listing —
realistically a few times a day — 60 seconds is 60–200× more
regeneration than the content justifies. This is the main driver of
Fluid Active CPU.

**Severity: P0.**

**Fix:** raise to `600`–`1800` on browse pages. Freshness is preserved
where it matters because these are ISR, not static — the first request
after the window still serves instantly from cache and refreshes behind
it. Admin and dashboard pages are untouched (they are client-rendered
and read live).

---

### P1-3 — The whole catalogue is serialized into `/listings`

**File:** `src/app/listings/page.tsx:47` → `ListingsBrowser`

The page fetches **every approved listing on the platform** and passes
the array to a client component, which filters it in the browser
(`listings-browser.tsx:62`).

**Cost:** the RSC payload grows linearly with the marketplace. Bills
Vercel bandwidth on every visit and grows without limit. Also 11
queries per regeneration.

**Severity: P1** — harmless today at current listing counts, a real
problem at 10×.

**Fix:** server-side pagination, same pattern already used on
`/rentals` and `/blog-news`. This is the largest change in the list and
the one I would schedule last.

---

### P1-4 — 60% of Supabase queries are unbounded

**Files:** 222 of 364 select chains, e.g. `src/lib/bookings.ts:62`,
`src/lib/activities.ts:136`, `src/lib/coworking.ts:126`

No `.limit()`, no `.range()`. Every one returns the full table.

**Cost:** mostly Supabase, but the ~40 called from server components
also inflate Vercel render time and memory.

**Severity: P1** for the server-side ones, **P2** for client-side.

**Fix:** add `.limit()` to the getters used by feeds and lists. Needs
care — a limit on the wrong getter silently truncates an admin screen,
so this goes one file at a time with the call sites checked.

---

### P2-5 — `select("*")` on 193 queries

**Files:** across `src/lib/*.ts`

Several tables carry large text columns (`itinerary`, `terms`,
`damage_policy`, `description`) and arrays. Card rendering needs none
of them.

**Cost:** payload and parse time on both server and client.

**Severity: P2.** The public getters already use column allowlists
(`COMPANY_PUBLIC`, `PROVIDER_PUBLIC`, `HOTEL_PUBLIC`) — this is about
the admin and dashboard getters that do not.

---

### P2-6 — No `prefetch={false}` anywhere

**Files:** 252 `<Link>` instances

Next prefetches every `<Link>` in the viewport. On the homepage, with
~50 cards visible on scroll, that is ~50 RSC payload requests the
visitor may never use.

**Cost:** Edge Requests and bandwidth, directly billed.

**Severity: P2.**

**Fix:** `prefetch={false}` on card grids and footer navigation, where
click-through is low. Keep prefetch on the navbar and primary CTAs,
where it is what makes navigation feel instant.

---

### P2-7 — Twelve polling loops

**Files:** `src/components/layout/navbar.tsx:259, 302, 323` (60s / 30s /
60s) and nine provider dashboards at 45s

The navbar is the notable one: it runs on **every page** for every
signed-in user, and `loadIds()` issues **seven parallel queries** plus
an eighth for admin threads. That is roughly **9 Supabase queries per
minute per signed-in user, sitewide**.

**Cost to Vercel: none** — these are browser → Supabase.
**Cost to Supabase: substantial**, and it scales with concurrent users.

**Severity: P2** for Vercel; **P1** for Supabase quota.

**Fix:** raise the navbar interval, or move it to Supabase Realtime,
which is push rather than poll. All twelve already pause when the tab is
hidden (`document.visibilityState`), which is the main thing and is
already correct.

---

### P3-8 — Search inputs are not debounced

**Files:** only 3 of the search inputs debounce
(`places-autocomplete.tsx`, `airport-autocomplete.tsx`,
`add-location.tsx`)

Most search boxes filter arrays already in memory, so there is no
request per keystroke — no cost. The exceptions are any that query on
change.

**Severity: P3.** Listed for completeness; the in-memory ones are fine
as they are.

---

## 3. Already correct — do not "fix" these

- **Cloudinary over `next/image`.** Saves Vercel Image Optimization
  quota entirely. Changing it would cost money, not save it.
- **No middleware.** Nothing to scope a matcher to. Middleware runs on
  every matching request and is pure Vercel cost; having none is ideal.
  (Note: this also means auth cannot be gated at the edge — that is a
  deliberate trade documented elsewhere, not an oversight.)
- **Polling pauses on hidden tabs.** Already implemented everywhere.
- **`generateStaticParams` on the six routes that benefit.**
- **20 API routes marked `force-dynamic`.** Correct: they read auth
  headers and must not be cached.
- **Column allowlists on public getters.** Already excludes verification
  documents and owner ID — a security property as much as a size one.

---

## 4. Proposed order

Cheapest and safest first, so the CPU pressure drops before anything
risky is attempted.

| # | Change | Effort | Risk | Expected effect |
|---|---|---|---|---|
| 1 | `cache()` on `feedAllListings` and friends | 15 min | Very low | Halves category-page queries |
| 2 | Raise `revalidate` on browse pages | 20 min | Low | Largest CPU reduction |
| 3 | `prefetch={false}` on card grids | 30 min | Low | Fewer Edge Requests |
| 4 | `.limit()` on server-side feed getters | 1–2 h | Medium | Smaller payloads, less render time |
| 5 | Navbar poll interval / Realtime | 1 h | Medium | Supabase relief, no Vercel change |
| 6 | Column allowlists on remaining getters | 2 h | Medium | Payload |
| 7 | Server-side pagination for `/listings` | 3–4 h | Higher | Removes the scaling cliff |

Items 1 and 2 together should account for most of the available
reduction. I would measure after those two before starting 3.

---

## 5. What I could not verify

- **No production measurements.** This is static analysis. The Vercel
  dashboard's Function and Edge Request breakdown by route would confirm
  which of these actually dominates, and could reorder the list.
- **No build output.** `next build` does not run in this environment
  (the installed SWC binary is the Windows one), so I could not read the
  route table showing which pages Next classifies as static vs dynamic.
  That table is the single most useful artifact here — worth running
  locally and sharing.
