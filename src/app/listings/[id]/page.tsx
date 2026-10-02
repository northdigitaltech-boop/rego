import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ListingDetail } from "@/components/listings/listing-detail";
import { PrettyListingUrl } from "@/components/listings/pretty-listing-url";
import { extractListingId } from "@/lib/utils";
import { listingMetadata, type ListingSeoInput } from "@/lib/listing-seo";
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
 * ============================================================ */
async function listingSeoInputFor(id: string): Promise<ListingSeoInput | null> {
  const stayRow =
    (await getHotelRowById(id)) ??
    (await getHomestayRowById(id)) ??
    (await getHostelRowById(id));
  if (stayRow) {
    return {
      id,
      name: stayRow.title,
      kind: stayRow.category_label || "Stay",
      location: stayRow.location,
      text: stayRow.description,
      image: stayRow.image,
      facts: [stayRow.price ? `From PKR ${Number(stayRow.price).toLocaleString("en-PK")}${stayRow.unit ? ` / ${stayRow.unit}` : ""}` : null],
      status: stayRow.status,
    };
  }

  const c = await getCompanyRowById(id);
  if (c) {
    return {
      id, name: c.name, kind: "Travel company", location: c.location,
      text: c.description, image: c.cover_image || c.logo, status: c.status,
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
    };
  }

  const t = await getTransportById(id);
  if (t) {
    return {
      id, name: t.name, kind: "Vehicle hire", location: t.location,
      provider: t.company_name, image: t.image,
      facts: [t.vehicle_type, t.model_year, t.fuel_type, t.transmission, t.luggage_capacity],
      status: t.status,
    };
  }

  const g = await getGuideById(id);
  if (g) {
    return {
      id, name: g.name, kind: "Tour guide", location: g.city || g.location,
      provider: g.company_name, text: g.bio, image: g.image, status: g.status,
    };
  }

  const svc = await getServiceById(id);
  if (svc) {
    return {
      id, name: svc.title, kind: "Transport service", location: svc.location,
      text: svc.description, image: svc.image, facts: [svc.vehicle_type],
      status: svc.status,
    };
  }

  const rnt = await getRentalById(id);
  if (rnt) {
    return {
      id, name: rnt.title, kind: "Vehicle rental", location: rnt.location,
      text: rnt.description, image: rnt.image, facts: [rnt.vehicle_type],
      status: rnt.status,
    };
  }

  const mp = await getMediaProviderRowById(id);
  if (mp) {
    return {
      id, name: mp.name, kind: mp.service_type || "Photographer",
      location: mp.city || mp.location, provider: mp.company_name,
      text: mp.bio, image: mp.cover_image || mp.logo, status: mp.status,
    };
  }

  const rest = await getRestaurantRowById(id);
  if (rest) {
    return {
      id, name: rest.name, kind: "Restaurant", location: rest.city || rest.location,
      text: rest.description, image: rest.cover_image || rest.logo,
      facts: [rest.address], status: rest.status,
    };
  }

  return null;
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = extractListingId(rawId);

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
      </main>
      <Footer />
    </>
  );
}
