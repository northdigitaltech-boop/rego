import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ListingDetail } from "@/components/listings/listing-detail";
import { PrettyListingUrl } from "@/components/listings/pretty-listing-url";
import { extractListingId } from "@/lib/utils";
import { listingMetadata, listingJsonLd, type ListingSeoInput } from "@/lib/listing-seo";
import { JsonLd } from "@/components/seo/json-ld";
import { listingHubLinks } from "@/lib/listing-hub-links";
import { HotelProfile } from "@/components/listings/hotel-profile";
import { paymentConfigFrom, type PaymentConfig } from "@/lib/payments";
import { HomestayProfile } from "@/components/listings/homestay-profile";
import { HostelProfile } from "@/components/listings/hostel-profile";
import { CompanyProfile } from "@/components/listings/company-profile";
import { PhotographerProfile } from "@/components/listings/photographer-profile";
import { listings, type Listing } from "@/lib/data";
import {
  getHotelRowById,
  getRoomsByHotel,
  rowToListing,
} from "@/lib/hotels";
import {
  getHomestayRowById,
  getRoomsByHomestay,
  type HomestayRow,
  type HomestayRoomRow,
} from "@/lib/homestays";
import {
  getHostelRowById,
  getRoomsByHostel,
  type HostelRow,
  type HostelRoomRow,
} from "@/lib/hostels";
import { TourCompanyProfile } from "@/components/listings/tour-company-profile";
import { TourItemDetail } from "@/components/listings/tour-item-detail";
import {
  getCompanyRowById,
  getApprovedPackagesByCompany,
  getApprovedTransportsByCompany,
  getApprovedGuidesByCompany,
  getPackageById,
  getTransportById,
  getGuideById,
  type TourCompanyRow,
  type TourPackageRow,
  type TransportRow,
  type TourGuideRow,
} from "@/lib/tour-companies";
import { TransportItemDetail } from "@/components/listings/transport-item-detail";
import {
  getServiceById,
  getRentalById,
  getProviderRowById,
  getApprovedServicesByProvider,
  getApprovedRentalsByProvider,
  type TransportServiceRow,
  type RentalVehicleRow,
  type TransportProviderRow,
} from "@/lib/transport";
import { GuideProfile } from "@/components/listings/guide-profile";
import { getServicesByGuide, type GuideServiceRow } from "@/lib/guide-services";
import { MediaDetail } from "@/components/listings/media-detail";
import {
  getMediaProviderRowById,
  getPortfolioByProvider,
  getApprovedMediaByCompany,
  type MediaProviderRow,
  type MediaPortfolioRow,
} from "@/lib/media";
import {
  getMediaServicesByProvider,
  type MediaServiceRow,
} from "@/lib/media-services";
import { RestaurantDetail } from "@/components/listings/restaurant-detail";
import {
  getRestaurantRowById,
  getMenuByRestaurant,
  type RestaurantRow,
  type MenuItemRow,
} from "@/lib/restaurants";

export function generateStaticParams() {
  return listings.map((l) => ({ id: l.id }));
}

// Allow on-demand rendering for database hotels not in generateStaticParams.
export const dynamicParams = true;
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
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: rawId } = await params;
  const id = extractListingId(rawId);
  const input = await listingSeoInputFor(id);
  /* Not found: noindex, and the page body calls notFound() for the 404. */
  if (!input) return { title: "Listing not found", robots: { index: false, follow: false } };
  return listingMetadata(input);
}

/* ============================================================
 * Each listing type, mapped onto the one shape listingMetadata
 * understands. Order matches the page body's own lookup.
 *
 * Stays use the ROW getters rather than the Listing ones: same
 * one query, but the row carries description and status, which
 * the Listing shape drops. Without them a hotel with a full
 * written description would be judged as having none.
 *
 * facts are PUBLIC details only. TransportRow also holds
 * vehicle_number and driver_contact — deliberately absent here.
 *
 * LOCATION USES EVERY REAL FIELD THE SITE SHOWS — learned the hard
 * way. The listing card reads `location || route` for a transport
 * service; reading only `location` marked "Female drivers" (Skardu,
 * real photo) as having no location, so it would have been dropped
 * from Google while showing "Skardu" to every visitor. Each fallback
 * below mirrors that type's *ToListing(). The "Gilgit Baltistan"
 * constant those end with is deliberately NOT copied: it is a display
 * default, not something the provider told us.
 * ============================================================ */
/* cache(): generateMetadata and the page body both need this, and Supabase
   calls are not deduplicated the way fetch() is. Without it every listing
   page would run the whole lookup chain twice per request. Server-only;
   outside a request it simply calls through. */
const listingSeoInputFor = cache(async (id: string): Promise<ListingSeoInput | null> => {
  /* Looked up one table at a time (not ??-chained) so the schema type can
     say which kind of stay this is. Same queries, same order as before. */
  const hotel = await getHotelRowById(id);
  const homestay = hotel ? null : await getHomestayRowById(id);
  const hostel = hotel || homestay ? null : await getHostelRowById(id);
  const stayRow = hotel ?? homestay ?? hostel;
  if (stayRow) {
    const label = stayRow.category_label || "";
    return {
      id,
      name: stayRow.title,
      kind: label || "Stay",
      location: stayRow.location,
      text: stayRow.description,
      image: stayRow.image,
      facts: [stayRow.price ? `From PKR ${Number(stayRow.price).toLocaleString("en-PK")}${stayRow.unit ? ` / ${stayRow.unit}` : ""}` : null],
      status: stayRow.status,
      /* Hostels are Hostel. A hotels-table row is only called Hotel or
         Resort when its own label says so — "The Hunza guest house" lives in
         that table and is not a hotel. Everything else: LodgingBusiness. */
      schemaType: hostel
        ? "Hostel"
        : hotel && /resort/i.test(label)
          ? "Resort"
          : hotel && /hotel/i.test(label)
            ? "Hotel"
            : "LodgingBusiness",
      priceFrom: Number(stayRow.price) || null,
      priceUnit: stayRow.unit,
      table: hotel ? "hotels" : homestay ? "homestays" : "hostels",
      serviceSlug: hotel ? "hotels" : homestay ? "homestays" : "hostels",
    };
  }

  const c = await getCompanyRowById(id);
  if (c) {
    return {
      id, name: c.name, kind: "Travel company", location: c.location,
      text: c.description, image: c.cover_image || c.logo, status: c.status,
      schemaType: "TravelAgency", table: "tour_companies", serviceSlug: "travel-companies",
    };
  }

  const p = await getPackageById(id);
  if (p) {
    return {
      id, name: p.title, kind: "Tour package",
      location: p.destination || p.location, provider: p.company_name,
      text: p.itinerary, image: p.image,
      facts: [p.duration, p.package_type, p.difficulty_level],
      status: p.status,
      schemaType: "TouristTrip", table: "tour_packages", serviceSlug: "tours",
    };
  }

  const t = await getTransportById(id);
  if (t) {
    return {
      id, name: t.name, kind: "Vehicle hire", location: t.location || t.areas?.[0],
      provider: t.company_name, image: t.image,
      facts: [t.vehicle_type, t.model_year, t.fuel_type, t.transmission, t.luggage_capacity],
      status: t.status,
      /* transports has no location_id (phase72 skipped it) — no hub links. */
      schemaType: "Service", table: "transports", serviceSlug: "transport",
    };
  }

  const g = await getGuideById(id);
  if (g) {
    return {
      id, name: g.name, kind: "Tour guide", location: g.city || g.location || g.areas?.[0],
      provider: g.company_name, text: g.bio, image: g.image, status: g.status,
      schemaType: "Service", table: "tour_guides", serviceSlug: "guides",
    };
  }

  const svc = await getServiceById(id);
  if (svc) {
    return {
      id, name: svc.title, kind: "Transport service",
      location: svc.location || svc.route || svc.pickup_location,
      text: svc.description, image: svc.image, facts: [svc.vehicle_type],
      status: svc.status,
      schemaType: "Service", table: "transport_services", serviceSlug: "transport",
    };
  }

  const rnt = await getRentalById(id);
  if (rnt) {
    return {
      id, name: rnt.title, kind: "Vehicle rental",
      location: rnt.location || rnt.pickup_location,
      text: rnt.description, image: rnt.image, facts: [rnt.vehicle_type],
      status: rnt.status,
      schemaType: "Service", table: "rental_vehicles", serviceSlug: "transport",
    };
  }

  const mp = await getMediaProviderRowById(id);
  if (mp) {
    return {
      id, name: mp.name, kind: mp.service_type || "Photographer",
      location: mp.city || mp.location || mp.areas?.[0], provider: mp.company_name,
      text: mp.bio, image: mp.cover_image || mp.logo, status: mp.status,
      schemaType: "Service", table: "media_providers", serviceSlug: "photographers",
    };
  }

  const rest = await getRestaurantRowById(id);
  if (rest) {
    return {
      id, name: rest.name, kind: "Restaurant", location: rest.city || rest.location,
      text: rest.description, image: rest.cover_image || rest.logo,
      facts: [rest.address], status: rest.status,
      schemaType: "Restaurant", streetAddress: rest.address,
      table: "restaurants", serviceSlug: "restaurants",
    };
  }

  return null;
});

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = extractListingId(rawId);
  const seoInput = await listingSeoInputFor(id);
  const seoLd = seoInput ? listingJsonLd(seoInput) : null;
  const hubLinks =
    seoInput?.table && seoInput.serviceSlug
      ? await listingHubLinks(seoInput.table, id, seoInput.serviceSlug)
      : [];

  let listing: Listing | null = listings.find((l) => l.id === id) ?? null;
  let dbRooms:
    | {
        id: string;
        name: string;
        price: number;
        guests: number;
        beds: string;
        features: string[];
        total_units: number;
        images: string[];
        room_size: string | null;
        view_type: string | null;
        classification: string | null;
        wifi_climate: string | null;
      }[]
    | undefined;
  let dbAmenities: string[] | null | undefined;
  let dbDescription: string | null | undefined;
  let dbGallery: string[] | null | undefined;
  let dbOwnerEmail: string | null | undefined;
  let dbPaymentConfig: PaymentConfig | undefined;
  let dbRankingBadge: string | undefined;
  let homestayData: { homestay: HomestayRow; rooms: HomestayRoomRow[] } | null =
    null;
  let hostelData: { hostel: HostelRow; rooms: HostelRoomRow[] } | null = null;
  let tourCompany: {
    company: TourCompanyRow;
    packages: TourPackageRow[];
    transports: TransportRow[];
    guides: TourGuideRow[];
    media: MediaProviderRow[];
  } | null = null;
  let tourItem: {
    kind: "package" | "transport" | "guide";
    pkg?: TourPackageRow;
    transport?: TransportRow;
    guide?: TourGuideRow;
    company: TourCompanyRow | null;
  } | null = null;
  let transportItem: {
    kind: "service" | "rental";
    service?: TransportServiceRow;
    rental?: RentalVehicleRow;
    provider: TransportProviderRow | null;
    related: { id: string; title: string; image: string; price: number; listingType: "service" | "rental" }[];
  } | null = null;
  let guideDetail: {
    guide: TourGuideRow;
    company: TourCompanyRow | null;
    services: GuideServiceRow[];
    relatedPackages: TourPackageRow[];
  } | null = null;
  let mediaDetail: {
    provider: MediaProviderRow;
    services: MediaServiceRow[];
    portfolio: MediaPortfolioRow[];
    company: TourCompanyRow | null;
    relatedPackages: TourPackageRow[];
  } | null = null;
  let restaurantDetail: {
    restaurant: RestaurantRow;
    menu: MenuItemRow[];
  } | null = null;

  // Not a static listing → look up a database hotel, then a homestay, then tour.
  if (!listing) {
    const row = await getHotelRowById(id);
    if (row) {
      listing = rowToListing(row);
      dbAmenities = row.amenities;
      dbDescription = row.description;
      dbGallery = row.gallery;
      dbOwnerEmail = row.owner_email;
      dbPaymentConfig = paymentConfigFrom(row as unknown as Record<string, unknown>);
      dbRankingBadge = row.ranking_badge ?? undefined;
      const rooms = await getRoomsByHotel(id);
      dbRooms = rooms.map((r) => ({
        id: r.id,
        name: r.name,
        price: r.price,
        guests: r.guests,
        beds: r.beds,
        features: r.features ?? [],
        total_units: r.total_units ?? 1,
        images: r.images ?? [],
        room_size: r.room_size ?? null,
        view_type: r.view_type ?? null,
        classification: r.classification ?? null,
        wifi_climate: r.wifi_climate ?? null,
      }));
    } else {
      const hs = await getHomestayRowById(id);
      if (hs) {
        homestayData = { homestay: hs, rooms: await getRoomsByHomestay(id) };
      } else {
        const company = await getCompanyRowById(id);
        if (company) {
          const [packages, transports, guides, media] = await Promise.all([
            getApprovedPackagesByCompany(id),
            getApprovedTransportsByCompany(id),
            getApprovedGuidesByCompany(id),
            getApprovedMediaByCompany(id),
          ]);
          tourCompany = { company, packages, transports, guides, media };
        } else {
          const pkg = await getPackageById(id);
          if (pkg) {
            tourItem = {
              kind: "package",
              pkg,
              company: pkg.company_id
                ? await getCompanyRowById(pkg.company_id)
                : null,
            };
          } else {
            const tr = await getTransportById(id);
            if (tr) {
              tourItem = {
                kind: "transport",
                transport: tr,
                company: tr.company_id
                  ? await getCompanyRowById(tr.company_id)
                  : null,
              };
            } else {
              const gd = await getGuideById(id);
              if (gd) {
                const gCompany = gd.company_id
                  ? await getCompanyRowById(gd.company_id)
                  : null;
                const [gServices, gPackages] = await Promise.all([
                  getServicesByGuide(gd.id),
                  gd.company_id
                    ? getApprovedPackagesByCompany(gd.company_id)
                    : Promise.resolve([] as TourPackageRow[]),
                ]);
                guideDetail = {
                  guide: gd,
                  company: gCompany,
                  services: gServices,
                  relatedPackages: gPackages,
                };
              } else {
                const svc = await getServiceById(id);
                const rnt = svc ? null : await getRentalById(id);
                if (svc || rnt) {
                  const pid = svc?.provider_id ?? rnt?.provider_id ?? null;
                  const provider = pid ? await getProviderRowById(pid) : null;
                  let related: {
                    id: string;
                    title: string;
                    image: string;
                    price: number;
                    listingType: "service" | "rental";
                  }[] = [];
                  if (pid) {
                    const [pSvc, pRnt] = await Promise.all([
                      getApprovedServicesByProvider(pid),
                      getApprovedRentalsByProvider(pid),
                    ]);
                    related = [
                      ...pSvc.map((s) => ({
                        id: s.id,
                        title: s.title,
                        image: s.image || "",
                        price: s.price_per_day || s.price_per_trip || 0,
                        listingType: "service" as const,
                      })),
                      ...pRnt.map((r) => ({
                        id: r.id,
                        title: r.title,
                        image: r.image || "",
                        price: r.price_per_day,
                        listingType: "rental" as const,
                      })),
                    ].filter((x) => x.id !== id);
                  }
                  transportItem = {
                    kind: svc ? "service" : "rental",
                    service: svc ?? undefined,
                    rental: rnt ?? undefined,
                    provider,
                    related,
                  };
                }
              }
            }
          }
        }
      }
    }
  }

  // Media provider (photographer / videographer) detail.
  if (
    !listing &&
    !homestayData &&
    !tourCompany &&
    !tourItem &&
    !transportItem &&
    !guideDetail
  ) {
    const mp = await getMediaProviderRowById(id);
    if (mp) {
      const [mServices, mPortfolio, mCompany, mPackages] = await Promise.all([
        getMediaServicesByProvider(mp.id),
        getPortfolioByProvider(mp.id),
        mp.company_id ? getCompanyRowById(mp.company_id) : Promise.resolve(null),
        mp.company_id
          ? getApprovedPackagesByCompany(mp.company_id)
          : Promise.resolve([] as TourPackageRow[]),
      ]);
      mediaDetail = {
        provider: mp,
        services: mServices,
        portfolio: mPortfolio,
        company: mCompany,
        relatedPackages: mPackages,
      };
    }
  }

  // Hostel detail (separate module, mirrors homestays).
  if (
    !listing &&
    !homestayData &&
    !tourCompany &&
    !tourItem &&
    !transportItem &&
    !guideDetail &&
    !mediaDetail
  ) {
    const hostelRow = await getHostelRowById(id);
    if (hostelRow) {
      hostelData = { hostel: hostelRow, rooms: await getRoomsByHostel(id) };
    }
  }

  // Restaurant detail.
  if (
    !listing &&
    !homestayData &&
    !hostelData &&
    !tourCompany &&
    !tourItem &&
    !transportItem &&
    !guideDetail &&
    !mediaDetail
  ) {
    const rest = await getRestaurantRowById(id);
    if (rest) {
      restaurantDetail = { restaurant: rest, menu: await getMenuByRestaurant(rest.id) };
    }
  }

  if (
    !listing &&
    !homestayData &&
    !hostelData &&
    !tourCompany &&
    !tourItem &&
    !transportItem &&
    !guideDetail &&
    !mediaDetail &&
    !restaurantDetail
  )
    notFound();

  const isStay =
    !!listing &&
    (listing.category === "hotels" || listing.category === "homestays");
  const isCompany =
    !!listing &&
    (listing.category === "transport" ||
      listing.category === "travel-companies");
  const isPhotographer = !!listing && listing.category === "photographers";

  return (
    <>
      <Navbar />
      <PrettyListingUrl id={id} />
      {/* Same cached lookup as generateMetadata — no extra queries. Null
          for a listing with no honest address, so nothing is emitted rather
          than an invalid LocalBusiness block. */}
      {seoLd && <JsonLd data={seoLd} />}
      <main className="min-h-screen">
        {tourCompany ? (
          <TourCompanyProfile
            company={tourCompany.company}
            packages={tourCompany.packages}
            transports={tourCompany.transports}
            guides={tourCompany.guides}
            media={tourCompany.media}
          />
        ) : tourItem ? (
          <TourItemDetail
            kind={tourItem.kind}
            pkg={tourItem.pkg}
            transport={tourItem.transport}
            guide={tourItem.guide}
            company={tourItem.company}
          />
        ) : transportItem ? (
          <TransportItemDetail
            kind={transportItem.kind}
            service={transportItem.service}
            rental={transportItem.rental}
            provider={transportItem.provider}
            related={transportItem.related}
          />
        ) : guideDetail ? (
          <GuideProfile
            guide={guideDetail.guide}
            company={guideDetail.company}
            services={guideDetail.services}
            relatedPackages={guideDetail.relatedPackages}
          />
        ) : mediaDetail ? (
          <MediaDetail
            provider={mediaDetail.provider}
            services={mediaDetail.services}
            portfolio={mediaDetail.portfolio}
            company={mediaDetail.company}
            relatedPackages={mediaDetail.relatedPackages}
          />
        ) : restaurantDetail ? (
          <RestaurantDetail
            restaurant={restaurantDetail.restaurant}
            menu={restaurantDetail.menu}
          />
        ) : homestayData ? (
          <HomestayProfile
            homestay={homestayData.homestay}
            rooms={homestayData.rooms}
          />
        ) : hostelData ? (
          <HostelProfile
            hostel={hostelData.hostel}
            rooms={hostelData.rooms}
          />
        ) : isStay && listing ? (
          <HotelProfile
            listing={listing}
            dbRooms={dbRooms}
            dbAmenities={dbAmenities}
            dbDescription={dbDescription}
            dbGallery={dbGallery}
            ownerEmail={dbOwnerEmail}
            paymentConfig={dbPaymentConfig}
            rankingBadge={dbRankingBadge}
          />
        ) : isCompany && listing ? (
          <CompanyProfile listing={listing} />
        ) : isPhotographer && listing ? (
          <PhotographerProfile listing={listing} />
        ) : listing ? (
          <ListingDetail listing={listing} />
        ) : null}
        {/* Up-links to the hub pages above this listing. Rendered only when
            each target page is confirmed to exist — see listingHubLinks().
            A listing with no location_id simply shows nothing here. */}
        {hubLinks.length > 0 && (
          <nav aria-label="Explore this area" className="container-px pb-14">
            <h2 className="font-display text-xl font-bold text-forest">Explore more</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {hubLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="inline-flex items-center rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-forest hover:border-forest-600 hover:bg-forest-50"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </main>
      <Footer />
    </>
  );
}
