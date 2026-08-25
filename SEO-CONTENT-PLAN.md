# REGO — SEO Content Plan

**Written:** 25 August 2026
**Baseline (Search Console, last 3 months):** 24 clicks · 544 impressions · 4.4% CTR · avg position 16.2

---

## The honest diagnosis

544 impressions over three months is about **six per day**. That is not a ranking
problem — it is a supply problem. Google can only show pages that exist, and
right now there are very few pages that answer anything a traveller types.

The two queries showing up (`rego travel`, `rego office`) are brand queries, and
`rego office` at position 74 is almost certainly somebody looking for something
else entirely. For the queries that actually matter — *skardu hotels*,
*skardu tour package price*, *islamabad to skardu by road*, *best time to visit
hunza* — the site is not appearing at all.

**What is already right:** sitemap, canonical tags, structured data, the answers
system, `llms.txt`, mobile rendering. The plumbing is sound. There is just
almost nothing flowing through it.

| | Now | Needed to compete |
|---|---|---|
| Blog posts | 1 | 25–30 |
| Destination pages | 8 | 8 done well, then 15+ |
| Answers per destination | 2 (Skardu) | 8–12 |
| Listings | ~15 | 100+ |

---

## Rule that applies to everything below

**Do not invent a single fact.** No fares, no distances, no opening dates, no
road conditions, no "best" claims without a source. If a number cannot be
checked today, write the page without it. A page that says "flights are
weather-dependent and cancellations are common" is more useful — and safer —
than one that states a fare that was true last year.

This is also why seven of the ten drafted Skardu answers are still unpublished.
They are not blocked by the software; they are blocked by needing a real source.

---

## Phase 1 — Finish what is already built (this week)

No writing required. These are the fastest wins available.

1. **Run `supabase/phase88-publish-verified-answers.sql`.** Publishes the Skardu
   answers that need no verification.

2. **Fill in the seven held-back Skardu answers.** Section 3 of that migration
   prints each question with exactly what it still needs. Each one is a
   ten-minute research job:

   | Question | What to find |
   |---|---|
   | Best time to visit | This year's Deosai / pass opening pattern, described as typical rather than fixed |
   | Islamabad to Skardu | Current airlines and daily flight count, with the airline as source |
   | Trip cost | Real current price ranges — or drop the numbers and describe what drives cost |
   | Places to visit | Confirm or soften the driving times |
   | Deosai open | This year's dates and the current entry fee, with a source |
   | Family trip | Link to Rego listings instead of describing properties |
   | Packing | Current permit/entry rules for foreign nationals, official source |

3. **Write SEO titles and descriptions for the 8 destinations** in the admin SEO
   editor. The code now generates a sensible default, but a hand-written title
   for Skardu and Hunza will beat the generic one.

4. **Replace the placeholder images.** At least one live listing ("Car") is
   using a random `picsum.photos` stock image. Several pages fall back to it.
   A real photo or a branded fallback — never a random stock image.

5. **Get more listings.** This is the single biggest lever and it is not a
   writing job. Fifteen listings cannot support a marketplace, and every new
   listing is a new indexable page with unique content.

---

## Phase 2 — Destination depth (weeks 1–4)

Eight destination pages exist. Right now they are mostly a heading, some
attractions and a listings grid. Each needs to become the best page on the
internet for *"<place> travel guide"*.

**Target: 8–12 published answers per destination**, same format as Skardu.

Priority order — highest search demand first:

| # | Destination | Primary query |
|---|---|---|
| 1 | Skardu | skardu travel guide / skardu hotels |
| 2 | Hunza | hunza valley tour / hunza hotels |
| 3 | Fairy Meadows | fairy meadows trip / fairy meadows booking |
| 4 | Naran | naran kaghan tour package |
| 5 | Deosai | deosai national park |
| 6 | Gilgit | gilgit hotels / gilgit to skardu |
| 7 | Khaplu | khaplu palace / khaplu valley |
| 8 | Shigar | shigar fort / shigar valley |

The questions to answer on each are the same ones every traveller asks:

- Where is it and what is it known for
- Best time to visit
- How to get there (air and road)
- How many days to allow
- What it costs
- Main places to see
- Do I need a 4x4
- Is it suitable for families
- What to pack
- Where to stay

---

## Phase 3 — Blog posts (weeks 2–12)

One post a week. Each targets one real query. Write for someone planning a
trip, not for a search engine.

### Tier 1 — highest intent, write these first

| # | Title | Target query |
|---|---|---|
| 1 | Islamabad to Skardu: by air and by road, and what to expect | islamabad to skardu |
| 2 | How much does a trip to Gilgit-Baltistan cost? | gilgit baltistan trip cost |
| 3 | Best time to visit Gilgit-Baltistan, month by month | best time to visit gilgit baltistan |
| 4 | Skardu in 5 days: a realistic itinerary | skardu itinerary |
| 5 | Hunza in 4 days: a realistic itinerary | hunza itinerary |
| 6 | Karakoram Highway road guide | karakoram highway travel |
| 7 | Where to stay in Skardu: neighbourhoods and what they cost | where to stay in skardu |
| 8 | Do you need a permit for Gilgit-Baltistan? | gilgit baltistan permit |

### Tier 2 — trip planning

| # | Title | Target query |
|---|---|---|
| 9 | Deosai National Park: when it opens and how to visit | deosai national park guide |
| 10 | Fairy Meadows: the jeep track, the walk, and the huts | fairy meadows how to reach |
| 11 | Renting a jeep in Gilgit-Baltistan: what to ask before you pay | jeep rental skardu |
| 12 | Gilgit-Baltistan with children: what works and what does not | gilgit baltistan family trip |
| 13 | What to pack for the northern areas | what to pack gilgit baltistan |
| 14 | Solo travel in Gilgit-Baltistan | solo travel pakistan north |
| 15 | Altitude in the north: how to take it seriously | altitude sickness pakistan north |

### Tier 3 — interest and seasonality

| # | Title | Target query |
|---|---|---|
| 16 | The lakes of Skardu | skardu lakes |
| 17 | Shigar and Khaplu: the Baltistan forts | khaplu palace / shigar fort |
| 18 | Trekking routes for a first-timer in the Karakoram | karakoram trekking routes |
| 19 | Cherry blossom season in Hunza | hunza blossom season |
| 20 | Autumn in Hunza | hunza autumn colours |
| 21 | Winter in Gilgit-Baltistan: what stays open | gilgit baltistan in winter |
| 22 | Balti food: what to eat in Baltistan | balti food skardu |
| 23 | Polo in Gilgit-Baltistan: Shandur and the local grounds | shandur polo festival |
| 24 | Photography in the north: where and when | gilgit baltistan photography spots |
| 25 | Mobile signal and internet in the north | internet in gilgit baltistan |

### How each post should be built

- **1,200–2,000 words.** Shorter than that rarely ranks for a planning query.
- **Answer the question in the first paragraph.** Do not warm up.
- **Link to at least 3 Rego pages** — the destination page, a category page, and
  a relevant listing. This is how a blog post turns into a booking, and how
  Google learns which of your pages matter.
- **Real photographs**, with descriptive alt text.
- **A named author** with a real byline. Never an email address.
- **Say when it was last checked.** For anything seasonal, this matters more
  than the publish date.

---

## Phase 4 — Off-site (ongoing)

Content alone will not close a competitive gap. A new domain needs signals that
it is real.

1. **Google Business Profile** for REGO in Skardu. Free, and it is how local
   searches find you.
2. **Ask every listed provider to link to their Rego page** from their Facebook
   page, Instagram bio or website. Fifteen providers is fifteen links.
3. **Local tourism directories and GB tourism association listings.**
4. **Submit the sitemap in Search Console** and use URL Inspection → Request
   Indexing on each new page the day it publishes.

---

## What to expect, honestly

There is no way to be on page one next month for a competitive query. Search
results move slowly, and a domain with 90 pages is competing against sites with
thousands.

A realistic shape, if a post a week actually ships:

| | Impressions/month | Where you would rank |
|---|---|---|
| Today | ~180 | 16th on average, mostly brand queries |
| Month 3 | 1,000–2,000 | Page one for long-tail: "bilamik valley", "basho valley camping" |
| Month 6 | 4,000–8,000 | Page one for mid-tail: "skardu itinerary", "islamabad to skardu road" |
| Month 12 | 15,000+ | Competing for "skardu hotels", "gilgit baltistan tour package" |

These are shapes, not promises — they assume the content actually gets
written and listings keep growing. The single strongest predictor is how many
weeks in a row a post ships.

**Start with the long tail.** "Bilamik valley Roundu" has almost no competition
and you know it better than anyone writing in English. Winning ten queries like
that builds the authority you need before "skardu hotels" is reachable at all.

---

## Measuring it

Check Search Console monthly, not daily. Watch, in this order:

1. **Impressions** — is Google finding more to show? This moves first.
2. **Number of distinct queries** — are you appearing for more things? This is
   the real signal that content is working.
3. **Average position** — this moves last. Ignore it for the first two months.
4. **Clicks** — the outcome, but a lagging one.

If impressions climb while position stays flat, that is normal and good: you are
appearing for more queries, which drags the average down while the site grows.
