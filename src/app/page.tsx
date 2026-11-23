import type { Metadata } from "next";

import { buildMetadata } from "@/lib/seo";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/home/hero";
import { getHeroImage } from "@/lib/hero-image";
import { Destinations } from "@/components/home/destinations";
import { getDestinations } from "@/lib/destinations";
import { withLiveCounts } from "@/lib/destination-counts";
import { cachedAllListings } from "@/lib/home-feed-cached";
import { Categories } from "@/components/home/categories";
import { FeaturedGrid } from "@/components/home/featured-grid";
import {
  RentalsSection,
  RoadsideSection,
  MIN_LIVE_ITEMS,
} from "@/components/home/curated-sections";
import { DeferredCreators } from "@/components/home/deferred-creators";
import { RoadsideProviderGrid } from "@/components/home/roadside-grid";
import { EventsGrid } from "@/components/home/events-grid";
import { ActivitiesGrid } from "@/components/home/activities-grid";
import { ExpeditionsGrid } from "@/components/home/expeditions-grid";
import { SoloConnectSection } from "@/components/home/solo-connect-section";
import { SafarnamaSection } from "@/components/home/safarnama-section";
import { PromoCarousel } from "@/components/home/promo-carousel";
import { DeferredMarketing } from "@/components/home/deferred-marketing";
import { DeferredTail } from "@/components/home/deferred-tail";
import { getActiveAdSlides } from "@/lib/ad-slides";
import {
  feedHotels,
  feedPackages,
  feedTransport,
  feedCompanies,
  feedPhotographers,
  feedGuides,
  feedRestaurants,
  feedRoadside,
  feedEvents,
  feedActivities,
  feedExpeditions,
  feedSolo,
  feedStories,
} from "@/lib/home-feed";

/* ISR window. Marketplace content changes when a provider lists or an
   admin approves — a few times a day, not every minute. At 60s every
   path regenerated up to 60 times an hour whether anything had changed
   or not, which was the main driver of Vercel Fluid Active CPU.

   This is ISR, not static: the first request after the window still
   serves instantly from cache and refreshes behind it, so nobody waits.
   The visible cost is that a newly approved listing can take this long
   to appear. */
export const revalidate = 600;

/* The homepage now owns its canonical, which used to come from the root
   layout and leak onto every other page. absoluteTitle bypasses the
   "%s — Rego" template so the homepage title is not "Rego — Rego". */
/* The H1 has said "Gilgit Baltistan Tourism Marketplace" all along; the title
   tag said "Book Your Entire Trip in One Place", which is a nice line and
   names nothing anybody searches for. A title tag is the strongest signal a
   page has, and this one was spending it on a slogan.

   58 characters, so Google shows all of it. absoluteTitle because the layout's
   "— Rego" suffix would otherwise make it "… | REGO — Rego". */
export const metadata: Metadata = buildMetadata({
  absoluteTitle: "REGO | Gilgit Baltistan Tourism Marketplace & Travel Booking",
  description:
    "Hotels, tour packages, transport, guides and activities across " +
    "Gilgit-Baltistan — Skardu, Hunza, Gilgit and beyond. Book local " +
    "providers directly on Rego.",
  path: "/",
});

export default async function Home() {
  const [hero, popularDestinations] = await Promise.all([
    getHeroImage(),
    /* Counts computed from live listings, never the admin-typed text. */
    Promise.all([
      getDestinations().catch(() => []),
      cachedAllListings().catch(() => null),
    ]).then(([d, l]) => withLiveCounts(d, l)),
  ]);
  const [
    hotels,
    packages,
    transport,
    companies,
    photographers,
    guides,
    restaurants,
    roadside,
    events,
    activities,
    expeditions,
    solo,
    stories,
  ] = await Promise.all([
    feedHotels(12),
    feedPackages(4),
    feedTransport(4),
    feedCompanies(4),
    feedPhotographers(4),
    feedGuides(4),
    feedRestaurants(4),
    feedRoadside(4),
    feedEvents(4),
    feedActivities(4),
    feedExpeditions(4),
    feedSolo(4),
    feedStories(3),
  ]);

  // Sponsored slides (hidden entirely when none are active).
  const adSlides = await getActiveAdSlides();

  return (
    <>
      <Navbar />
      <main>
        {/* Hero & universal search (unchanged) */}
        {/* The preload lives here, not in the root layout. It used to sit in
            <head> for every route, naming the built-in files — which meant
            every page on the site preloaded a hero only the homepage shows,
            and an admin-set hero could never be preloaded at all. React
            hoists this link into <head> from where it is rendered. */}
        {/* When there is a separate phone hero, both preloads carry a media
            query so each browser fetches only the one it will paint. Without
            the query on the desktop link, a phone would download both. */}
        {hero.mobile && (
          <link
            rel="preload"
            as="image"
            href={hero.mobile.src}
            imageSrcSet={hero.mobile.srcSet}
            imageSizes="(max-width: 768px) 70vw, 100vw"
            media="(max-width: 640px)"
            fetchPriority="high"
          />
        )}
        <link
          rel="preload"
          as="image"
          href={hero.src}
          imageSrcSet={hero.srcSet}
          imageSizes="(max-width: 768px) 70vw, 100vw"
          media={hero.mobile ? "(min-width: 641px)" : undefined}
          fetchPriority="high"
        />
        <Hero image={hero} />

        {/* Popular Destinations */}
        <Destinations initial={popularDestinations} />

        {/* Services Categories */}
        <Categories />

        {/* Featured Hotels & Accommodation */}
        <FeaturedGrid
          title="Featured Hotels & Accommodation"
          subtitle="Verified stays across Gilgit-Baltistan."
          items={hotels}
          viewAllHref="/categories/hotels"
          viewAllLabel="View All Hotels"
          carousel
        />

        {/* Tour Packages — "Trending … loved by travellers" claimed popularity
            nothing measures, and the row is not limited to Gilgit-Baltistan
            (a Swat Valley tour appears in it), so the label now says only
            what is true. */}
        <FeaturedGrid
          title="Tour Packages"
          subtitle="Trips from local operators listed on Rego."
          items={packages}
          viewAllHref="/categories/tours"
          viewAllLabel="View All Packages"
          alt
          variant="journey"
        />

        {/* Reliable Transportation Services */}
        <FeaturedGrid
          title="Reliable Transportation Services"
          subtitle="Jeeps, cars and drivers you can trust."
          items={transport}
          viewAllHref="/categories/transport"
          viewAllLabel="View All Transport"
          variant="spec"
        />

        {/* Sponsored promotions — advertisers, admin-managed */}
        <div id="promotions" className="scroll-mt-24">
          <PromoCarousel slides={adSlides} />
        </div>

        {/* Best Travel Companies */}
        <FeaturedGrid
          title="Travel Companies"
          subtitle="Full-service tour operators & DMCs."
          items={companies}
          viewAllHref="/categories/travel-companies"
          viewAllLabel="View All Companies"
          hidePrice
          alt
          variant="brand"
        />

        {/* Capture Every Adventure */}
        <FeaturedGrid
          title="Capture Every Adventure"
          subtitle="Photographers & videographers for your trip."
          items={photographers}
          viewAllHref="/categories/photographers"
          viewAllLabel="View All Creators"
        />

        {/* Rentals */}
        <RentalsSection />

        {/* Featured Tour Guides */}
        <FeaturedGrid
          title="Featured Tour Guides"
          subtitle="Expert local storytellers."
          items={guides}
          viewAllHref="/categories/guides"
          viewAllLabel="View All Guides"
          alt
          variant="person"
        />

        {/* Restaurants & Local Food */}
        <FeaturedGrid
          title="Restaurants & Local Food"
          subtitle="Taste authentic GB cuisine."
          items={restaurants.length >= MIN_LIVE_ITEMS ? restaurants : []}
          viewAllHref="/categories/restaurants"
          viewAllLabel="View All Restaurants"
          variant="food"
        />

        {/* Featured drone & media creators */}
        <DeferredCreators />

        {/* Activities (below drone creators) — real approved activities,
            falls back to the curated tiles until providers add some. */}
        {/* Real activities only, and only from two upward. The curated tiles
            that used to fill an empty row linked to empty category pages. */}
        {activities.length >= MIN_LIVE_ITEMS && <ActivitiesGrid items={activities} />}

        {/* Mountaineering & Expeditions — straight after Activities, because
            an expedition is the same impulse one step further. Companies and
            individual professionals together, as on /expeditions. Renders
            nothing at all until something is approved: there is no curated
            fallback here, and a heading over an empty row would advertise a
            category Rego cannot yet serve. */}
        <ExpeditionsGrid items={expeditions} />

        {/* Roadside Assistance — real provider cards (falls back to service
            categories until providers register). */}
        {roadside.length > 0 ? (
          <RoadsideProviderGrid items={roadside} />
        ) : (
          <RoadsideSection />
        )}

        {/* Events & Expo — real admin-published events (falls back to the
            curated tiles until events are added). */}
        {/* Upcoming events only (past ones are filtered in getPublishedEvents).
            No curated festival tiles: they linked to /destinations, not to
            any event. One real upcoming event is worth showing. */}
        {events.length > 0 && <EventsGrid items={events} />}

        {/* Connect Solo Traveler — real traveller cards (falls back to a
            create-profile CTA until travellers register). */}
        <SoloConnectSection items={solo} />

        {/* Safarnama — traveller stories (falls back to a write-story CTA). */}
        <SafarnamaSection items={stories} />

        {/* AI CTA, Why Us & Testimonials — lazy-loaded (non-SEO marketing tail). */}
        <DeferredMarketing />

        {/* Platform statistics and the newsletter band, on the same terms:
            below fifteen other sections, no SEO weight, and their JavaScript
            was loading on arrival for readers who never scrolled that far. */}
        <DeferredTail />
      </main>
      <Footer />
    </>
  );
}
