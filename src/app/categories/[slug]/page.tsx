import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isRoadsideService } from "@/lib/roadside";
import { isEventCategory } from "@/lib/events";
import { isActivityCategory, isIndoorActivity } from "@/lib/activities";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ListingsBrowser } from "@/components/listings/listings-browser";
import { HotelCategoryView } from "@/components/listings/hotel-category-view";
import { CompanyCategoryView } from "@/components/listings/company-category-view";
import {
  TransportCategoryView,
  type TransportCardItem,
} from "@/components/listings/transport-category-view";
import { GuideCategoryView } from "@/components/listings/guide-category-view";
import { MediaCategoryView } from "@/components/listings/media-category-view";
import {
  getApprovedMediaProviders,
  type MediaProviderRow,
} from "@/lib/media";
import { RestaurantCategoryView } from "@/components/listings/restaurant-category-view";
import {
  getApprovedRestaurants,
  type RestaurantRow,
} from "@/lib/restaurants";
import { allCategories, getCategory } from "@/lib/data";
import { getHotels } from "@/lib/hotels";
import { getHomestays } from "@/lib/homestays";
import { getHostels } from "@/lib/hostels";
import {
  getApprovedPackages,
  getApprovedTransports,
  getApprovedGuides,
  getApprovedCompanies,
  packageToListing,
  type TourCompanyRow,
  type TourGuideRow,
} from "@/lib/tour-companies";
import {
  getApprovedServices,
  getApprovedRentals,
  getApprovedProviders,
} from "@/lib/transport";

export function generateStaticParams() {
  return allCategories.map((c) => ({ slug: c.slug }));
}

// Always fetch fresh hotel data from the database.
export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) return { title: "Category not found" };
  const description = `${category.tagline}. Browse ${category.name} across Gilgit Baltistan on Rego.`;
  return {
    title: category.name,
    description,
    alternates: { canonical: `/categories/${slug}` },
    openGraph: {
      title: `${category.name} — Rego`,
      description,
      url: `/categories/${slug}`,
      type: "website",
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const query = (Array.isArray(sp.location) ? sp.location[0] : sp.location) ?? "";
  // Roadside services have a dedicated, fully-functional module.
  if (isRoadsideService(slug)) redirect(`/roadside/${slug}`);
  // Events & Expo has a dedicated, admin-managed module.
  if (isEventCategory(slug)) redirect(`/events?category=${slug}`);
  // Activities has a dedicated, provider-driven module.
  if (slug === "activities") redirect("/activities");
  if (slug === "mountaineering") redirect("/expeditions");
  if (isActivityCategory(slug))
    redirect(
      isIndoorActivity(slug)
        ? `/activities?kind=indoor&category=${slug}`
        : `/activities?category=${slug}`
    );
  const category = getCategory(slug);
  if (!category) notFound();

  // Hotels and homestays are served live from the Supabase database.
  let dbHotels = null;
  if (category.slug === "hotels") {
    const hotels = await getHotels();
    if (hotels.length > 0) dbHotels = hotels;
  } else if (category.slug === "homestays") {
    const stays = await getHomestays();
    if (stays.length > 0) dbHotels = stays;
  } else if (category.slug === "hostels") {
    const stays = await getHostels();
    if (stays.length > 0) dbHotels = stays;
  } else if (category.slug === "tours") {
    const x = await getApprovedPackages();
    if (x.length > 0) dbHotels = x.map(packageToListing);
  }

  // Tour guides render with their own filtered card grid.
  let dbGuides: TourGuideRow[] | null = null;
  if (category.slug === "guides") {
    const g = await getApprovedGuides();
    if (g.length > 0) dbGuides = g;
  }

  // Photographers & videographers render with their own filtered grid.
  let dbMedia: MediaProviderRow[] | null = null;
  if (category.slug === "photographers") {
    const m = await getApprovedMediaProviders();
    if (m.length > 0) dbMedia = m;
  }

  // Restaurants render with their own filtered grid + menu pages.
  let dbRestaurants: RestaurantRow[] | null = null;
  if (category.slug === "restaurants") {
    const x = await getApprovedRestaurants();
    if (x.length > 0) dbRestaurants = x;
  }

  // Tour companies render as their own card grid.
  let dbCompanies: TourCompanyRow[] | null = null;
  if (category.slug === "travel-companies") {
    const c = await getApprovedCompanies();
    if (c.length > 0) dbCompanies = c;
  }

  // Transport & Rental aggregates dedicated providers + tour-company vehicles.
  let dbTransport: TransportCardItem[] | null = null;
  if (category.slug === "transport") {
    const [services, rentals, tourVehicles, providers, companies] =
      await Promise.all([
        getApprovedServices(),
        getApprovedRentals(),
        getApprovedTransports(),
        getApprovedProviders(),
        getApprovedCompanies(),
      ]);
    const providerVerified = new Map(providers.map((p) => [p.id, p.verified]));
    const companyVerified = new Map(companies.map((c) => [c.id, c.verified]));

    const items: TransportCardItem[] = [
      ...services.map((s) => ({
        id: s.id,
        title: s.title,
        listingType: "service" as const,
        vehicleType: s.vehicle_type || "Vehicle",
        seats: s.seats,
        price: s.price_per_day || s.price_per_trip || 0,
        unit: s.price_per_day ? "day" : "trip",
        location: s.location || s.route || "Gilgit Baltistan",
        provider: s.provider_name,
        verified: !!(s.provider_id && providerVerified.get(s.provider_id)),
        featured: s.featured,
        rating: Number(s.rating),
        reviews: s.reviews,
        image: s.image || "",
      })),
      ...tourVehicles.map((t) => ({
        id: t.id,
        title: t.name,
        listingType: "service" as const,
        vehicleType: t.vehicle_type || "Vehicle",
        seats: t.seats,
        price: t.price_per_day || t.price_per_trip || 0,
        unit: t.price_per_day ? "day" : "trip",
        location: t.location || "Gilgit Baltistan",
        provider: t.company_name,
        verified: !!(t.company_id && companyVerified.get(t.company_id)),
        featured: false,
        rating: Number(t.rating),
        reviews: t.reviews,
        image: t.image || "",
      })),
      ...rentals.map((r) => ({
        id: r.id,
        title: r.title,
        listingType: "rental" as const,
        vehicleType: r.vehicle_type || "Vehicle",
        seats: r.seats,
        price: r.price_per_day,
        unit: "day",
        location: r.location || r.pickup_location || "Gilgit Baltistan",
        provider: r.provider_name,
        verified: !!(r.provider_id && providerVerified.get(r.provider_id)),
        featured: r.featured,
        rating: Number(r.rating),
        reviews: r.reviews,
        image: r.image || "",
      })),
    ].sort((a, b) => Number(b.featured) - Number(a.featured));
    if (items.length > 0) dbTransport = items;
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        {dbRestaurants ? (
          <RestaurantCategoryView
            restaurants={dbRestaurants}
            heading={category.name}
            subheading={category.tagline}
            query={query}
          />
        ) : dbMedia ? (
          <MediaCategoryView
            providers={dbMedia}
            heading={category.name}
            subheading={category.tagline}
            query={query}
          />
        ) : dbGuides ? (
          <GuideCategoryView
            guides={dbGuides}
            heading={category.name}
            subheading={category.tagline}
            query={query}
          />
        ) : dbTransport ? (
          <TransportCategoryView
            items={dbTransport}
            heading={category.name}
            subheading={category.tagline}
            query={query}
          />
        ) : dbCompanies ? (
          <CompanyCategoryView
            companies={dbCompanies}
            heading={category.name}
            subheading={category.tagline}
            query={query}
          />
        ) : dbHotels ? (
          <HotelCategoryView
            hotels={dbHotels}
            heading={category.name}
            subheading={category.tagline}
            query={query}
          />
        ) : (
          <Suspense
            fallback={
              <div className="container-px py-20 text-center text-muted-foreground">
                Loading…
              </div>
            }
          >
            <ListingsBrowser
              initialCategory={category.slug}
              initialLocation={query || undefined}
              heading={category.name}
              subheading={category.tagline}
            />
          </Suspense>
        )}
      </main>
      <Footer />
    </>
  );
}
