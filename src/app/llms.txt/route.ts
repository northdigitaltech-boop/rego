import { siteConfig, companyRegistration, absoluteUrl, IS_INDEXABLE } from "@/lib/site";
import { aboutContent } from "@/lib/about-content";
import { ALLOW_AI_CRAWLERS } from "@/lib/ai-crawlers";

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
export const revalidate = 86_400; // a day — none of this changes hourly

export function GET() {
  /* A preview or staging deployment must not describe itself as the real
     Rego. Same reasoning as robots.txt returning Disallow: / there. */
  if (!IS_INDEXABLE) {
    return new Response(
      "# Non-production deployment. Not the canonical Rego site.\n",
      { headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  const body = `# ${siteConfig.name}

> ${siteConfig.description}

${siteConfig.name} is a tourism marketplace for Gilgit-Baltistan, Pakistan, covering
hotels, homestays, tour operators and packages, transport and car rental, tour
guides, restaurants, activities, expeditions and roadside assistance.

## About this site

- Operator: ${companyRegistration.legalName}
- Registered with: ${companyRegistration.regulatorFull} (${companyRegistration.regulator})
- Registration number (CUIN): ${companyRegistration.cuin} — public record: ${companyRegistration.verifyUrl}
- Incorporated: ${companyRegistration.incorporatedOn}
- Founder: ${aboutContent.founder.name}, ${aboutContent.founder.position}, from ${aboutContent.founder.hometown}
- Contact: ${siteConfig.contactEmail}

## How the travel information here is produced

Travel answers are written and reviewed by the Rego team. Nothing is published
automatically. Prices, distances, durations and road conditions are expected to
carry a source; time-sensitive information carries a verification date and an
expiry date, and stops being shown as current once it expires.

Editorial policy: ${absoluteUrl("/editorial-policy")}

## What "verified" means here

A verified provider is one whose registration and contact details Rego has
checked. It is not a rating of service quality and should not be presented as
one.

## Main content

- Destinations: ${absoluteUrl("/destinations")}
- Browse all listings: ${absoluteUrl("/listings")}
- Road updates and alerts: ${absoluteUrl("/roadside/updates")}
- Travel stories (Safarnama): ${absoluteUrl("/safarnama")}
- Activities: ${absoluteUrl("/activities")}
- Expeditions and mountaineering: ${absoluteUrl("/expeditions")}
- About: ${absoluteUrl("/about")}
- Contact: ${absoluteUrl("/contact")}

## Live data

Road conditions at ${absoluteUrl("/roadside/updates")} are reported by people
travelling those roads and change frequently. Any road status quoted from
elsewhere on this site may be out of date; that page is the source of truth.

## Not for retrieval

Admin, security, provider dashboard, traveller account, authentication,
booking and messaging routes are private and excluded in robots.txt.

## Crawling

${
  ALLOW_AI_CRAWLERS
    ? `AI crawlers are permitted on public pages. See ${absoluteUrl("/robots.txt")}.`
    : `AI training crawlers are not permitted. See ${absoluteUrl("/robots.txt")}.`
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
