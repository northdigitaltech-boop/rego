import type { Metadata } from "next";

import { buildMetadata } from "@/lib/seo";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/home/hero";
import { getHeroImage } from "@/lib/hero-image";
import { Destinations } from "@/components/home/destinations";
import { Categories } from "@/components/home/categories";
import { FeaturedGrid } from "@/components/home/featured-grid";
import {
  ActivitiesSection,
  RentalsSection,
  RoadsideSection,
  EventsSection,
  PlatformStats,
} from "@/components/home/curated-sections";
import { FeaturedDroneCreators } from "@/components/home/featured-drone-creators";
import { RoadsideProviderGrid } from "@/components/home/roadside-grid";
import { EventsGrid } from "@/components/home/events-grid";
import { ActivitiesGrid } from "@/components/home/activities-grid";
import { SoloConnectSection } from "@/components/home/solo-connect-section";
import { SafarnamaSection } from "@/components/home/safarnama-section";
import { PromoCarousel } from "@/components/home/promo-carousel";
import { DeferredMarketing } from "@/components/home/deferred-marketing";
import { NewsletterSection } from "@/components/home/newsletter-section";
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
  feedSolo,
  feedStories,
} from "@/lib/home-feed";

export const revalidate = 60;

/* The homepage now owns its canonical, which used to come from the root
   layout and leak onto every other page. absoluteTitle bypasses the
   "%s — Rego" template so the homepage title is not "Rego — Rego". */
export const metadata: Metadata = buildMetadata({
  absoluteTitle: "Rego — Book Your Entire Trip in One Place",
  path: "/",
});

export default async function Home() {
  const hero = await getHeroImage();
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
        <link
          rel="preload"
          as="image"
          href={hero.src}
          imageSrcSet={hero.srcSet}
          imageSizes="100vw"
          fetchPriority="high"
        />
        <Hero image={hero} />

        {/* Popular Destinations */}
        <Destinations />

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

        {/* Trending Tour Packages */}
        <FeaturedGrid
          title="Trending Tour Packages"
          subtitle="Curated trips loved by travellers."
          items={packages}
          viewAllHref="/categories/tours"
          viewAllLabel="View All Packages"
          alt
          variant="journey"
        />

        {/* Reliable Transportation Services */}
        <FeaturedGrid
          title="Reliable Transportation Services"
          subtitle="Jeeps, cars and rentals you can trust."
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
          title="Best Travel Companies"
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
          items={restaurants}
          viewAllHref="/categories/restaurants"
          viewAllLabel="View All Restaurants"
          variant="food"
        />

        {/* Featured drone & media creators */}
        <FeaturedDroneCreators />

        {/* Activities (below drone creators) — real approved activities,
            falls back to the curated tiles until providers add some. */}
        {activities.length > 0 ? <ActivitiesGrid items={activities} /> : <ActivitiesSection />}

        {/* Roadside Assistance — real provider cards (falls back to service
            categories until providers register). */}
        {roadside.length > 0 ? (
          <RoadsideProviderGrid items={roadside} />
        ) : (
          <RoadsideSection />
        )}

        {/* Events & Expo — real admin-published events (falls back to the
            curated tiles until events are added). */}
        {events.length > 0 ? <EventsGrid items={events} /> : <EventsSection />}

        {/* Connect Solo Traveler — real traveller cards (falls back to a
            create-profile CTA until travellers register). */}
        <SoloConnectSection items={solo} />

        {/* Safarnama — traveller stories (falls back to a write-story CTA). */}
        <SafarnamaSection items={stories} />

        {/* AI CTA, Why Us & Testimonials — lazy-loaded (non-SEO marketing tail). */}
        <DeferredMarketing />

        {/* Platform Statistics */}
        <PlatformStats />

        {/* Newsletter signup (premium email-capture band) */}
        <NewsletterSection />
      </main>
      <Footer />
    </>
  );
}
