import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, MapPin } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ListingsBrowser } from "@/components/listings/listings-browser";
import { getDestinationBySlug } from "@/lib/destinations";
import { cachedAllListings } from "@/lib/home-feed-cached";
import { getCategory } from "@/lib/data";
import {
  contentLength,
  countListingsAt,
  decideIndexable,
  getLocationSeo,
  getOpenServices,
  getPublicLocationBySlug,
  locationPath,
} from "@/lib/location-seo";
import { BreadcrumbJsonLd, FaqJsonLd } from "@/components/seo/json-ld";
import { photo } from "@/lib/utils";
import { brandedTitle } from "@/lib/seo";
import { siteConfig, IS_INDEXABLE } from "@/lib/site";

/* ============================================================
 * Location + service landing page — "Hotels in Skardu".
 *
 * ---------------------------------------------------------------------------
 * THIS ROUTE IS THE EASIEST WAY TO DAMAGE THE DOMAIN.
 *
 * Thirteen districts crossed with fourteen services is 182
 * URLs, and most of them would have nothing on them. Google
 * calls that doorway spam and the penalty lands on the whole
 * site, not just the thin pages.
 *
 * So this page is deliberately hard to bring into existence:
 *
 *   • It 404s if the service is not open in this area. A page
 *     for something you cannot book here should not exist at
 *     all, not merely be noindex.
 *   • It is noindex unless decideIndexable() says otherwise —
 *     which needs real listings OR real written content.
 *   • The sitemap calls the SAME function, so the two cannot
 *     disagree about what is worth crawling.
 *
 * Being in the index is earned here, not granted.
 * ---------------------------------------------------------------------------
 */

// No generateStaticParams: these render on demand and revalidate. Pre-building
// every location x service combination is exactly the mass-generation this
// page is designed to avoid.
export const revalidate = 300;

type Params = Promise<{ slug: string; service: string }>;

/** Everything both metadata and the page body need, fetched once. */
async function load(slug: string, service: string) {
  const location = await getPublicLocationBySlug(slug).catch(() => null);
  if (!location) return null;

  const open = await getOpenServices(location.id).catch(() => []);
  const svc = open.find((s) => s.slug === service);
  if (!svc) return null; // service not available here → the page does not exist

  /* Kept, not discarded: the other services open in this area are the
     related-services links at the foot of the page. Already fetched to find
     svc, so reusing it costs no extra query. */
  const siblings = open.filter((s) => s.slug !== service);

  const [destination, seo, listingCount] = await Promise.all([
    getDestinationBySlug(slug).catch(() => null),
    getLocationSeo(location.id, service).catch(() => null),
    countListingsAt([location.id]).catch(() => 0),
  ]);

  const decision = decideIndexable({
    locationIsActive: true, // getOpenServices already required this
    locationIsPublic: true,
    seoEnabled: true,
    serviceAvailable: true,
    comingSoon: false,
    robotsIndex: seo?.robots_index ?? false,
    listingCount,
    contentChars: contentLength(seo),
  });

  return { location, svc, siblings, destination, seo, listingCount, decision };
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug, service } = await params;
  const d = await load(slug, service);
  if (!d) return { title: "Not found", robots: { index: false, follow: false } };

  const place = d.destination?.name ?? d.location.name;
  const title = d.seo?.seo_title?.trim() || `${d.svc.name} in ${place}`;
  const description =
    d.seo?.meta_description?.trim() ||
    `Browse ${d.svc.name.toLowerCase()} in ${place}, Gilgit-Baltistan. Compare options and book with Rego.`;

  const canonical =
    d.seo?.canonical_url?.trim() || locationPath(slug, service);

  /* The page's own hero, then the destination photo, then the brand card —
     so a share never goes out without an image. og_image was the only
     source before, and most locations have none set. */
  const ogImage =
    d.seo?.og_image || d.seo?.hero_image || d.destination?.image || siteConfig.ogImage;
  const ogTitle = d.seo?.og_title?.trim() || title;
  const ogDescription = d.seo?.og_description?.trim() || description;

  return {
    /* brandedTitle, not the raw string: seo_title is admin-typed and the
       live Skardu one already ends "with REGO", which the layout template
       then extended to "with REGO — Rego". */
    title: brandedTitle(title),
    description,
    alternates: { canonical },
    /* The single most important line on this page. A thin page that says
       noindex costs nothing; a thin page that says index costs the domain.
       IS_INDEXABLE as well, so a preview deployment can never say index
       even when decideIndexable() would. */
    robots: { index: IS_INDEXABLE && d.decision.index, follow: true },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: canonical,
      type: "website",
      siteName: siteConfig.name,
      images: [{ url: ogImage, alt: d.seo?.hero_image_alt || ogTitle }],
    },
    /* There was no twitter block at all, so X and every client that reads
       twitter:* fell back to a bare link with no card. */
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: [ogImage],
    },
  };
}

export default async function LocationServicePage({
  params,
}: {
  params: Params;
}) {
  const { slug, service } = await params;
  const d = await load(slug, service);
  if (!d) notFound();

  const { location, svc, siblings, destination, seo } = d;
  const place = destination?.name ?? location.name;
  const heroImage = seo?.hero_image || destination?.image;
  const allListings = await cachedAllListings();
  const category = getCategory(service);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Destinations", path: "/destinations" },
          { name: place, path: locationPath(slug) },
          { name: svc.name, path: locationPath(slug, service) },
        ]}
      />
      {seo?.faq?.length ? <FaqJsonLd items={seo.faq} /> : null}

      <Navbar />
      <main className="min-h-screen">
        <section className="relative isolate overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div
              className="h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url('${photo(heroImage)}')` }}
              role={seo?.hero_image_alt ? "img" : undefined}
              aria-label={seo?.hero_image_alt || undefined}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-forest-900/90 via-forest-900/55 to-forest-900/40" />
          </div>

          <div className="container-px flex min-h-[260px] flex-col justify-end py-10">
            {/* Visible breadcrumb, matching the JSON-LD above. It was missing
                "Home", which the JSON-LD has — Google expects the two to
                describe the same trail. */}
            <nav
              aria-label="Breadcrumb"
              className="flex flex-wrap items-center gap-1 text-sm text-white/80"
            >
              <Link href="/" className="hover:text-gold">
                Home
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <Link href="/destinations" className="hover:text-gold">
                Destinations
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <Link href={locationPath(slug)} className="hover:text-gold">
                {place}
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-gold">{svc.name}</span>
            </nav>

            <h1 className="mt-3 font-display text-4xl font-extrabold text-white sm:text-5xl">
              {seo?.h1?.trim() || `${svc.name} in ${place}`}
            </h1>

            {seo?.intro?.trim() && (
              <p className="mt-2 max-w-2xl text-lg text-white/85">{seo.intro}</p>
            )}

            <span className="mt-3 flex items-center gap-1.5 text-sm font-medium text-gold">
              <MapPin className="h-4 w-4" /> Gilgit-Baltistan
            </span>
          </div>
        </section>

        <Suspense
          fallback={
            <div className="container-px py-20 text-center text-muted-foreground">
              Loading…
            </div>
          }
        >
          <ListingsBrowser
            items={allListings}
            initialLocation={destination?.location ?? location.name}
            initialCategory={category?.slug}
            hideHeader
          />
        </Suspense>

        {seo?.body?.trim() && (
          <section className="container-px py-10">
            <div className="mx-auto max-w-3xl space-y-3 leading-relaxed text-muted-foreground">
              {seo.body.split(/\n{2,}/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
        )}

        {/* Visible FAQ — what makes the FAQPage markup above legitimate. */}
        {seo?.faq?.length ? (
          <section className="container-px pb-10">
            <h2 className="font-display text-2xl font-bold text-forest">
              {svc.name} in {place} — common questions
            </h2>
            <dl className="mx-auto mt-4 max-w-3xl divide-y divide-border">
              {seo.faq.map((f, i) => (
                <div key={i} className="py-4">
                  <dt className="font-semibold text-forest">{f.q}</dt>
                  <dd className="mt-1 leading-relaxed text-muted-foreground">{f.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {/* ------------------------------------------------------------
            RELATED SERVICES IN THE SAME PLACE

            Someone reading "Hotels in Skardu" usually needs a way to get
            there and something to do once they arrive. These links were
            the missing sideways half of the internal link graph — the
            page could only point back up to the destination.

            Built from getOpenServices(), the same list that decides
            whether a location+service page may exist at all. So every
            link here resolves to a real page; none can 404, and a
            service that is closed in this area is never offered.
            ------------------------------------------------------------ */}
        <section className="container-px pb-14">
          {siblings.length > 0 && (
            <>
              <h2 className="font-display text-xl font-bold text-forest">
                More in {place}
              </h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {siblings.map((s) => (
                  <li key={s.slug}>
                    <Link
                      href={locationPath(slug, s.slug)}
                      className="inline-flex items-center rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-forest hover:border-forest-600 hover:bg-forest-50"
                    >
                      {s.name} in {place}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <Link
            href={locationPath(slug)}
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-forest hover:border-forest-600 hover:bg-forest-50"
          >
            {place} travel guide
            <ChevronRight className="h-4 w-4" />
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
