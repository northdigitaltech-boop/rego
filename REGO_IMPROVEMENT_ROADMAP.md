# Rego — Improvement Roadmap

Your 32-module audit, resequenced by **impact per hour of work** rather than
by module number. Same items, different order.

The guiding principle: fix what makes Rego look *unfinished* before adding
depth, and fix what can *hurt someone* before either.

---

## Phase 0 — "Looks unfinished" (≈1 week)

The same three bugs repeated across eight modules. Small fixes, huge
perceived-quality gain. Do these before anything else — they are the reason
the site currently reads as a prototype.

| Fix | Modules affected | Notes |
|---|---|---|
| `0.0` ratings → "New" / "No reviews yet" | 4, 8, 11 | Already zeroed in DB (phase61); the UI still prints 0.0 |
| Hide `(0)` counts and empty categories | 8, 10 | Show nothing rather than proof of emptiness |
| Hide sections with no real listings | 1 | Homepage currently renders empty rails |
| Hide Call / WhatsApp when no number exists | 6, 8, 9 | Dead buttons destroy trust faster than missing ones |
| Remove placeholder numbers on profiles | 6, 9 | `+92 300 1234567` still shows on company/photographer pages |
| Floating AI + help buttons off auth pages | 3 | They cover the form on small phones |
| Floating buttons never cover card actions | 1, 13, 28 | Especially "Read Story" |
| **Safarnama raw Markdown** | 13 | Highest single visible-quality fix on the whole list |
| Skeleton loaders instead of blank space | 1, 28 | |

**Why first:** none of it needs new data, new schema, or a decision from you.
It is the difference between "unfinished" and "launched."

---

## Phase 1 — Safety and security (≈2–3 weeks)

Everything here is a *someone gets hurt* risk, not a polish item. Do not
launch marketing until this is done.

### Solo Traveler (11) — highest risk on the platform
- Connection states: pending / accepted / rejected / blocked
- **No messaging until a connection is accepted** (decision needed)
- Report and block, on every profile and every message thread
- Age gate and identity controls
- Never expose phone numbers by default

### Trust and Verification (12)
- Dynamic trust score with a visible explanation of how it's built
- Show which steps are complete, and when they were verified
- Remove any implication that a score guarantees safety
- Explicit disclaimer: verification reduces risk, does not remove it
- **Emergency-contact data revealed only in an authorised emergency flow**

### Security (30)
- Audit every Supabase RLS policy (this is the big one — permissive
  `using(true)` policies are currently doing app-layer filtering)
- Rate limiting on auth, search, AI, and report endpoints
- Upload validation: type and size limits
- Sanitize all user-generated Markdown and HTML
- Session expiry, secure password reset
- Account deletion and data export
- **CV files are currently public Cloudinary URLs — move to signed URLs**

### Roadside + Road Status (16, 17)
Safety-adjacent because people act on this data while driving.
- Fix contradictory states ("Open" + "Landslide" + "opening tomorrow")
- Consistent colours: green open / yellow delayed / red closed / blue seasonal
- Last updated, source, and **official vs community** clearly separated
- Auto-expire stale alerts
- Never present a user report as officially confirmed

---

## Phase 2 — The core loop (≈3–4 weeks)

Search is how people use a marketplace. It's rated Critical for good reason.

### Search (2)
- Auto-suggest while typing
- Recent searches + popular destinations
- Bigger tap targets on destination / dates / guests
- Field-level validation messages
- Remember filters between sessions
- Clear / reset
- Results scoped to the selected service type

### Homepage (1)
- Tighten spacing in the search card
- Make the active category obvious
- Consistent card spacing, icon size, radius
- Test on small phones — several sections are very tall

### Login / Registration (3)
- Turnstile is already in (invisible-friendly Managed mode) ✅
- Google login (Apple only matters once you have an iOS app)
- Keep me signed in
- Password manager / autofill / biometric support
- Better errors: wrong password vs unverified email vs expired code
- Resend countdown

---

## Phase 3 — Listing depth (≈4–6 weeks, one module at a time)

Modules 4–10. **Schema first, UI second, and keep fields optional.**

Order by how much revenue each drives for you:

1. **Hotels (4)** — room types, availability, amenities, tax clarity, price unit, filters
2. **Transport (7)** — seats, transmission, fuel/driver included, price unit, deposit
3. **Tours (5)** — duration, group size, inclusions/exclusions, day-by-day itinerary, dates
4. **Guides (6)** — languages, experience, specialisation, daily rate, availability
5. **Activities (8)** — inclusions, equipment, min age, difficulty, season, meeting point
6. **Restaurants (9)** — cuisine, hours, menu, price range, halal, open-now
7. **Events (10)** — countdown, organiser, tickets, capacity, status, add-to-calendar

**Warning:** resist making these required at signup. A partner who abandons
registration is worth less than a partner with a thin profile you can chase
later.

---

## Phase 4 — Money (blocked on your decisions)

Do not start until the business questions are answered.

### Payments (20) — needs: which provider?
Full price breakdown, payment states, receipts, transaction reference,
duplicate protection, webhook validation, refunds, disputes, timeouts.
**Never store raw card data** — that is a hard rule, not a preference.

### Booking (21)
Lifecycle: requested → pending → confirmed → paid → completed →
cancelled → refunded. Owner acceptance, availability locking, double-booking
prevention, cancellation policy, invoice, no-show handling.

### Flights (19) — needs: direct / affiliate / API partner?
Total fare including taxes, baggage, fare rules, refundability, layovers,
airline and provider identity, price-change warnings, failed-booking reversal.
**Never show a cached fare as live.**

---

## Phase 5 — Depth and growth (ongoing)

- **Rego AI (14)** — DB-first before the model ✅ partly done; still needs
  result cards with actions, clear separation of verified data vs AI advice,
  fallbacks, failed-query logging, and safeguards on medical/legal/emergency
  questions
- **Rego Map (15)** — clustering, legend, nearby search, real distance, ETA,
  open-in-navigation, emergency locations, GPS failure handling
- **Jobs (18)** — posted date, deadline, salary range, employer profile,
  status, saved jobs, scam detection, admin review before publish
- **Reviews (27)** — booking-verified reviews, categories, owner response,
  moderation, duplicate prevention
- **Notifications (22)** — grouping, preferences, dedupe across channels,
  quiet hours, unsubscribe
- **Admin (25)** — audit logs, role separation (admin / moderator / support /
  finance / super-admin), destructive-action confirmation
- **Business dashboard (26)** — completion %, stats, availability, payouts.
  Keep it simple at launch; do not overload owners
- **SEO (31)** — destination and category pages ✅ started, plus breadcrumbs,
  structured data, internal linking, sitemap separation
- **Analytics (32)** — the funnel events you listed. Worth doing early and
  cheaply: without them you'll be guessing at everything above
- **Performance (29)** — WebP/AVIF, lazy loading, caching, less client JS,
  error boundaries, low-end Android testing
- **UI consistency (28)** — a shared token pass: radius, shadow, icon size,
  button height, badge style, contrast on gold
- **About / Founder (23, 24)** — copy edits, honest status labels

---

## Decisions I need from you

1. **Flights** — selling directly, affiliate, or API partner?
2. **Payments** — which provider?
3. **Solo Traveler** — can people message before a connection is accepted?
4. **Launch date** — this changes everything about sequencing. If you're
   launching in 4 weeks, we do Phase 0 + 1 and nothing else.

---

## Honest notes

**On the schedule.** Phases 0–2 is roughly 6–8 weeks of steady work. The full
list is 3–6 months. Anything faster means cutting scope, not working harder.

**On analytics (32).** You put it last. Consider doing the basic events during
Phase 2. Everything after that is easier when you can see where people drop
out instead of guessing.

**On UI consistency (28).** Cheapest as a single pass across the whole app
rather than module-by-module — one set of tokens, applied everywhere.

**On low-end Android (29).** Worth buying a cheap device to test on. Your
audience is travelling in Gilgit-Baltistan on patchy 3G, not sitting on
office fibre.
