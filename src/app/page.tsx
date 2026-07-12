import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/home/hero";
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
import { AIAssistantCTA } from "@/components/home/ai-assistant-cta";
import { WhyUs } from "@/components/home/why-us";
import { Testimonials } from "@/components/home/testimonials";
import { NewsletterSection } from "@/components/home/newsletter-section";
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

export default async function Home() {
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

  return (
    <>
      <Navbar />
      <main>
        {/* Hero & universal search (unchanged) */}
        <Hero />

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
        />

        {/* Reliable Transportation Services */}
        <FeaturedGrid
          title="Reliable Transportation Services"
          subtitle="Jeeps, cars and rentals you can trust."
          items={transport}
          viewAllHref="/categories/transport"
          viewAllLabel="View All Transport"
        />

        {/* Best Travel Companies */}
        <FeaturedGrid
          title="Best Travel Companies"
          subtitle="Full-service tour operators & DMCs."
          items={companies}
          viewAllHref="/categories/travel-companies"
          viewAllLabel="View All Companies"
          hidePrice
          alt
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
        />

        {/* Restaurants & Local Food */}
        <FeaturedGrid
          title="Restaurants & Local Food"
          subtitle="Taste authentic GB cuisine."
          items={restaurants}
          viewAllHref="/categories/restaurants"
          viewAllLabel="View All Restaurants"
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

        {/* AI Travel Assistant CTA */}
        <AIAssistantCTA />

        {/* Why Choose Rego */}
        <WhyUs />

        {/* Testimonials */}
        <Testimonials />

        {/* Platform Statistics */}
        <PlatformStats />

        {/* Newsletter signup (premium email-capture band) */}
        <NewsletterSection />
      </main>
      <Footer />
    </>
  );
}
