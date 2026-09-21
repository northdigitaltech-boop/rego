import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ListingsBrowser } from "@/components/listings/listings-browser";
import { AttractionsSection } from "@/components/destinations/attractions-section";
import { destinations } from "@/lib/data";
import { getDestinationBySlug } from "@/lib/destinations";
import {
  getLocationSeo,
  getNearbyLocations,
  getPublicLocationBySlug,
  getOpenServices,
  locationPath,
} from "@/lib/location-seo";
import {
  BreadcrumbJsonLd,
  FaqJsonLd,
  TouristDestinationJsonLd,
} from "@/components/seo/json-ld";
import { getAnswers } from "@/lib/answers";
import { DirectAnswer, TravelFAQ } from "@/components/aeo/answer-blocks";

/* Answer content is rolled out one destination at a time. With the flag off
   this page behaves exactly as it did before Phase 2. */
const AEO_ENABLED = process.env.NEXT_PUBLIC_AEO_ENABLED === "1";
import { cachedAllListings } from "@/lib/home-feed-cached";
import { photo, cn } from "@/lib/utils";
import { destinationDescription, destinationTitle, tidyName } from "@/lib/seo-copy";

const QUICK_FILTERS = [
  { slug: "", label: "All" },
  { slug: "hotels", label: "Hotels" },
  { slug: "homestays", label: "Homestays" },
  { slug: "tours", label: "Tours" },
  { slug: "transport", label: "Transport" },
  /* Added with the rental split. Without it, rentals would still be in the
     feed for this destination and reachable from no filter on it — the
     Transport chip stopped matching them the moment they got their own
     category. */
  { slug: "vehicle-rental", label: "Vehicle Rental" },
  { slug: "guides", label: "Guides" },
  { slug: "restaurants", label: "Restaurants" },
];

// Pre-render the built-in destinations; admin-added ones render on demand.
export function generateStaticParams() {
  return destinations.map((d) => ({ slug: d.slug }));
}

/* ISR window. Marketplace content changes when a provider lists or an
   admin approves — a few times a day, not every minute. At 60s every
   path regenerated up to 60 times an hour whether anything had changed
   or not, which was the main driver of Vercel Fluid Active CPU.

   This is ISR, not static: the first request after the window still
   serves instantly from cache and refreshes behind it, so nobody waits.
   The visible cost is that a newly approved listing can take this long
   to appear. */
export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const destination = await getDestinationBySlug(slug);
  if (!destination) return { title: "Destination not found" };

  /* Admin-written SEO overrides the generated copy when it exists. Falls all
     the way back to today's behaviour when the market module is not on, so
     this page keeps working unchanged until somebody writes content for it. */
  const seo = await getLocationSeoForSlug(slug);

  /* The bare name ("SKARDU") was the whole title tag, which gave the page
     nothing to rank on. These fallbacks carry the words travellers actually
     type; admin-written SEO still wins whenever it exists. */
  const description =
    seo?.meta_description?.trim() ||
    destinationDescription(destination.name, destination.tagline);

  const title = seo?.seo_title?.trim() || destinationTitle(destination.name);
  const image = seo?.og_image || destination.image;

  /* CANONICAL IGNORES ?category= ON PURPOSE.
     The quick filters are the same page with a client-side filter applied —
     they contain no unique content, so every filtered view must point back
     here or they compete with each other for the same query. */
  const canonical = seo?.canonical_url?.trim() || `/destinations/${slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    robots: seo
      ? { index: seo.robots_index, follow: seo.robots_follow }
      : undefined,
    openGraph: {
      title: seo?.og_title?.trim() || `${tidyName(destination.name)} — Rego`,
      description: seo?.og_description?.trim() || description,
      url: canonical,
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: seo?.og_title?.trim() || tidyName(destination.name),
      description: seo?.og_description?.trim() || description,
      images: image ? [image] : undefined,
    },
  };
}

/**
 * SEO row for a destination slug, or null.
 *
 * Wrapped in its own try/catch: the market tables may not exist yet, and a
 * missing table must not turn a working destination page into a 500.
 */
async function getLocationSeoForSlug(slug: string) {
  try {
    const loc = await getPublicLocationBySlug(slug);
    if (!loc) return null;
    return await getLocationSeo(loc.id, null);
  } catch {
    return null;
  }
}

export default async function DestinationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const activeCat = (Array.isArray(sp.category) ? sp.category[0] : sp.category) ?? "";

  /* A chip is selected. Someone who taps "Hotels" has asked a narrower
     question than the page was answering, and the material above the listings
     — the attractions, the links to every other service — is now in the way of
     the answer. It is all still one tap back on "All". */
  const filtered = activeCat !== "";
  const activeLabel =
    QUICK_FILTERS.find((f) => f.slug === activeCat)?.label ?? "";
  const destination = await getDestinationBySlug(slug);
  if (!destination) notFound();
  const allListings = await cachedAllListings();

  /* Market data is optional. Every one of these returns empty rather than
     throwing when the tables do not exist, so this page renders exactly as
     it does today until the module is switched on. */
  const location = await getPublicLocationBySlug(slug).catch(() => null);
  const seo = location ? await getLocationSeo(location.id, null).catch(() => null) : null;
  const nearby = location ? await getNearbyLocations(location.id).catch(() => []) : [];
  const openServices = location ? await getOpenServices(location.id).catch(() => []) : [];

  /* Published answers for this destination. Behind a flag while Phase 2 is
     rolled out one destination at a time — with it off, this page renders
     exactly as it did before. Returns [] on any failure, so an answer
     lookup can never take the page down. */
  const answers =
    AEO_ENABLED && location
      ? await getAnswers({ locationId: location.id, limit: 20 }).catch(() => [])
      : [];

  const featuredAnswers = answers.filter((a) => a.is_featured).slice(0, 3);
  const otherAnswers = answers.filter((a) => !a.is_featured);

  const parentName = location?.path_slugs?.length
    ? location.path_slugs[location.path_slugs.length - 2]
    : null;

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Destinations", path: "/destinations" },
          { name: destination.name, path: `/destinations/${slug}` },
        ]}
      />
      <TouristDestinationJsonLd
        name={destination.name}
        description={seo?.meta_description || destination.tagline}
        image={seo?.og_image || destination.image}
        path={`/destinations/${slug}`}
        latitude={location?.latitude}
        longitude={location?.longitude}
        containedIn={parentName ? titleCase(parentName) : "Gilgit-Baltistan"}
      />
      {/* FAQ markup only when the legacy location_seo.faq block is what
          actually renders below. When governed answers exist, TravelFAQ owns
          the schema — emitting both would put two FAQPage blocks on one page,
          each describing a different set of questions. */}
      {otherAnswers.length === 0 && seo?.faq?.length ? (
        <FaqJsonLd items={seo.faq} />
      ) : null}
      <Navbar />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="relative isolate overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div
              className="h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url('${photo(destination.image)}')` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-forest-900/90 via-forest-900/50 to-forest-900/40" />
          </div>
          <div className="container-px flex min-h-[320px] flex-col justify-end py-10">
            <span className="flex items-center gap-1.5 text-sm font-medium text-gold">
              <MapPin className="h-4 w-4" /> Gilgit Baltistan
            </span>
            <h1 className="mt-2 font-display text-4xl font-extrabold text-white sm:text-5xl">
              {destination.name}
            </h1>
            <p className="mt-2 max-w-xl text-lg text-white/85">
              {destination.tagline}
            </p>
            <p className="mt-1 text-sm font-semibold text-gold">
              {destination.stays}
            </p>

            {/* Quick service filters — set the browser's category via the URL */}
            <div className="mt-5 flex flex-wrap gap-2">
              {QUICK_FILTERS.map((f) => {
                const active = activeCat === f.slug;
                const href = f.slug
                  ? `/destinations/${slug}?category=${f.slug}`
                  : `/destinations/${slug}`;
                return (
                  <Link
                    key={f.label}
                    href={href}
                    scroll={false}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-sm font-semibold backdrop-blur transition-colors",
                      active
                        ? "border-gold bg-gold text-forest-900"
                        : "border-white/40 bg-white/10 text-white hover:bg-white/20"
                    )}
                  >
                    {f.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Top attractions — admin-managed per destination. Hidden once a
            service is chosen: the question is now "which hotels", and a
            gallery of lakes above the answer is just something to scroll
            past. */}
        {!filtered && (
          <AttractionsSection
            items={destination.attractions ?? []}
            destinationName={destination.name}
            fallbackImage={destination.image}
          />
        )}

        {/* Admin-written destination content. Renders nothing when empty —
            an empty prose block is worse than no block. */}
        {seo?.intro?.trim() || seo?.body?.trim() ? (
          <section className="container-px py-10">
            <div className="mx-auto max-w-3xl space-y-4">
              {seo.intro?.trim() && (
                <p className="text-lg leading-relaxed text-foreground">{seo.intro}</p>
              )}
              {seo.body?.trim() && (
                <div className="space-y-3 leading-relaxed text-muted-foreground">
                  {seo.body.split(/\n{2,}/).map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : null}

        {/* Service links — the destination-to-service half of internal
            linking. Only services actually open here are shown, so no link
            leads to an empty page. */}
        {!filtered && openServices.length > 0 && (
          <section className="container-px py-8">
            <h2 className="font-display text-2xl font-bold text-forest">
              What you can book in {destination.name}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {openServices.map((s) => (
                <Link
                  key={s.slug}
                  href={locationPath(slug, s.slug)}
                  className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-forest transition-colors hover:border-forest-600 hover:bg-forest-50"
                >
                  {s.name} in {destination.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Says what is being shown, and offers the way back. Without this a
            filtered page just looks like a destination page with less on it. */}
        {filtered && activeLabel && (
          <div className="container-px pt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-2xl font-bold text-forest">
                {activeLabel} in {destination.name}
              </h2>
              <Link
                href={`/destinations/${slug}`}
                className="text-sm font-semibold text-forest-600 hover:text-gold"
              >
                Show everything in {destination.name}
              </Link>
            </div>
          </div>
        )}

        <Suspense
          fallback={
            <div className="container-px py-20 text-center text-muted-foreground">
              Loading…
            </div>
          }
        >
          <ListingsBrowser items={allListings} initialLocation={destination.location} hideHeader />
        </Suspense>

        {/* ---- Featured answers ----
            The two or three questions worth a full heading. Everything else
            goes in the FAQ below, so the page does not become a wall of
            headings. */}
        {featuredAnswers.length > 0 && (
          <section className="container-px space-y-10 py-10">
            {featuredAnswers.map((a) => (
              <DirectAnswer key={a.id} answer={a} />
            ))}
          </section>
        )}

        {/* ---- FAQ ----
            Governed answers when they exist, otherwise the older
            location_seo.faq copy. Both render visibly; only the governed
            path emits FAQPage schema, because only it carries verification
            dates and sources.

            Nothing renders when there is neither — no empty heading. */}
        {otherAnswers.length > 0 ? (
          <section className="container-px py-10">
            <TravelFAQ
              answers={otherAnswers}
              title={`Common questions about ${destination.name}`}
            />
          </section>
        ) : seo?.faq?.length ? (
          <section className="container-px py-10">
            <h2 className="font-display text-2xl font-bold text-forest">
              Common questions about {destination.name}
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

        {/* Nearby — admin-curated, not computed from distance. Two valleys
            20km apart can be a nine-hour drive over a pass that is shut. */}
        {nearby.length > 0 && (
          <section className="container-px pb-14">
            <h2 className="font-display text-2xl font-bold text-forest">
              Nearby destinations
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {nearby.map((n) => (
                <Link
                  key={n.id}
                  href={locationPath(n.slug)}
                  className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-forest transition-colors hover:border-forest-600 hover:bg-forest-50"
                >
                  {n.name}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}

/** "gilgit-baltistan" → "Gilgit Baltistan", for schema containedInPlace. */
function titleCase(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
