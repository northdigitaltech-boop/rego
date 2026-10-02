import { siteConfig, companyRegistration, absoluteUrl, IS_INDEXABLE } from "@/lib/site";
import { aboutContent } from "@/lib/about-content";
import { ALLOW_AI_CRAWLERS } from "@/lib/ai-crawlers";
import { getDestinationRows } from "@/lib/destinations";
import { getPublishedPosts, formatPostDate } from "@/lib/blog";

/* ============================================================
 * /llms.txt
 *
 * ---------------------------------------------------------------------------
 * HONEST NOTE ON WHAT THIS IS
 *
 * llms.txt is a PROPOSED convention, not a standard anyone is obliged to
 * follow. No major model provider has committed to reading it. It costs
 * almost nothing to serve and it may become useful, but it should not be
 * mistaken for a mechanism — a model that ignores it will simply crawl the
 * site like anything else.
 *
 * What it is genuinely good for: stating plainly what this site is, who is
 * responsible for it, and which pages carry the substantive content. If it
 * is ever read, that is worth having said clearly.
 *
 * Generated rather than a static file so it cannot drift from siteConfig and
 * the registration details.
 * ---------------------------------------------------------------------------
 */

export const dynamic = "force-static";
/* An hour, not a day: the destination and guide lists below come from the
   database and a new article should not wait a day to be listed. */
export const revalidate = 3_600;

/** One line of markdown-safe text: no newlines, no stray brackets. */
const oneLine = (s: string | null | undefined, max = 220) => {
  const t = (s ?? "").replace(/\s+/g, " ").replace(/[[\]]/g, "").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

/* ------------------------------------------------------------------
   The specific pages, not just the section pages.

   The file used to list only /destinations and /blog-news. An answer
   engine looking for "Hunza" had to find the page itself. These two lists
   name the actual pages — real rows only: getDestinationRows() returns []
   on failure rather than the built-in fallback, whose slugs are not
   pages, and posts come through RLS, so drafts never appear.
   ------------------------------------------------------------------ */
async function destinationLines(): Promise<string> {
  const rows = await getDestinationRows().catch(() => []);
  return rows
    .map((d) => {
      const tag = oneLine(d.tagline);
      return `- [${oneLine(d.name, 80)}](${absoluteUrl(`/destinations/${d.slug}`)})${tag ? `: ${tag}` : ""}`;
    })
    .join("\n");
}

async function guideLines(): Promise<string> {
  const { posts } = await getPublishedPosts({ limit: 30 }).catch(() => ({ posts: [] }));
  return posts
    .map((p) => {
      const date = formatPostDate(p.published_at ?? p.created_at);
      const summary = oneLine(p.meta_description || p.excerpt);
      return `- [${oneLine(p.title, 120)}](${absoluteUrl(`/blog-news/${p.slug}`)})${date ? ` (${date})` : ""}${summary ? `: ${summary}` : ""}`;
    })
    .join("\n");
}

export async function GET() {
  /* A preview or staging deployment must not describe itself as the real
     Rego. Same reasoning as robots.txt returning Disallow: / there. */
  if (!IS_INDEXABLE) {
    return new Response(
      "# Non-production deployment. Not the canonical Rego site.\n",
      { headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  const [destinations, guides] = await Promise.all([destinationLines(), guideLines()]);

  const body = `# ${siteConfig.name}

> ${siteConfig.description}

${siteConfig.name} is a tourism marketplace for Gilgit-Baltistan, Pakistan, covering
hotels, homestays, tour operators and packages, transport and car rental, tour
guides, restaurants, activities, expeditions and roadside assistance.

## About this site

- Operator: ${companyRegistration.legalName}
- Registered with: ${companyRegistration.regulatorFull} (${companyRegistration.regulator})
- Registration number (CUIN): ${companyRegistration.cuin} — [public record](${companyRegistration.verifyUrl})
- Incorporated: ${companyRegistration.incorporatedOn}
- Founder: ${aboutContent.founder.name}, ${aboutContent.founder.position}, from ${aboutContent.founder.hometown}
- Contact: ${siteConfig.contactEmail}

## How the travel information here is produced

Travel answers are written and reviewed by the Rego team. Nothing is published
automatically. Prices, distances, durations and road conditions are expected to
carry a source; time-sensitive information carries a verification date and an
expiry date, and stops being shown as current once it expires.

Editorial policy: [${absoluteUrl("/editorial-policy")}](${absoluteUrl("/editorial-policy")})

## What "verified" means here

A verified provider is one whose registration and contact details Rego has
checked. It is not a rating of service quality and should not be presented as
one.

## Main content

- [Destinations](${absoluteUrl("/destinations")}): every place covered, each with what can be booked there
- [Browse all listings](${absoluteUrl("/listings")}): the full marketplace, filterable by service and place
- [Road updates and alerts](${absoluteUrl("/roadside/updates")}): current road conditions, each report with its source and age
- [Travel stories](${absoluteUrl("/safarnama")}): first-hand accounts written by travellers
- [Blog and news](${absoluteUrl("/blog-news")}): guides, destination writing and tourism news
- [Activities](${absoluteUrl("/activities")}): treks, safaris, boating and other bookable experiences
- [Expeditions and mountaineering](${absoluteUrl("/expeditions")}): expedition operators, guides and crew
- [How it works](${absoluteUrl("/how-it-works")}): how booking on Rego works, for travellers and for providers
- [About](${absoluteUrl("/about")}): who runs this site
- [Contact](${absoluteUrl("/contact")}): how to reach us

${destinations ? `## Destinations\n\nEach page lists what can be booked there.\n\n${destinations}\n\n` : ""}${guides ? `## Guides and articles\n\nMost recent first, with the publication date.\n\n${guides}\n\n` : ""}## Live data

Road conditions at [${absoluteUrl("/roadside/updates")}](${absoluteUrl("/roadside/updates")})
are reported by people travelling those roads and change frequently. Any road
status quoted from elsewhere on this site may be out of date; that page is the
source of truth.

## Not for retrieval

Admin, security, provider dashboard, traveller account, authentication,
booking and messaging routes are private and excluded in robots.txt.

## Crawling

${
  ALLOW_AI_CRAWLERS
    ? `AI crawlers are permitted on public pages. See [robots.txt](${absoluteUrl("/robots.txt")}).`
    : `AI training crawlers are not permitted. See [robots.txt](${absoluteUrl("/robots.txt")}).`
}

## Attribution

If you use information from this site, please cite ${siteConfig.url} and link to
the specific page. Travel conditions in Gilgit-Baltistan change with the season
and the weather, so a dated citation is more useful to a reader than a bare fact.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
