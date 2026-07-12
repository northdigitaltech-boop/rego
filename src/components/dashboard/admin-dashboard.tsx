"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Info,
  BarChart3,
  KeyRound,
  Building2,
  Users,
  CalendarCheck,
  Wallet,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Search,
  LogOut,
  Star,
  PlusCircle,
  Trash2,
  MapPin,
  BadgeCheck,
  FileText,
  Eye,
  ChevronDown,
  Pencil,
  Clock,
  ArrowRight,
  MessageSquare,
  LifeBuoy,
  CalendarDays,
  Briefcase,
  Mountain,
  Compass,
  TriangleAlert,
  BookOpen,
} from "lucide-react";

import {
  listings,
  getCategory,
  categories,
  locations,
  type CategorySlug,
} from "@/lib/data";
import {
  listAll,
  addListing,
  removeListing,
  type PartnerListing,
} from "@/lib/partner-store";
import {
  getPendingHotels,
  setHotelStatus,
  getAllHotels,
  setHotelVerified,
} from "@/lib/hotels";
import {
  getPendingHomestays,
  setHomestayStatus,
  getAllHomestays,
  setHomestayVerified,
  setHomestayFeatured,
} from "@/lib/homestays";
import {
  getPendingHostels,
  setHostelStatus,
  getAllHostels,
  setHostelVerified,
  setHostelFeatured,
} from "@/lib/hostels";
import { setHotelFeatured } from "@/lib/hotels";
import { setRankingBadge, RANKING_OPTIONS } from "@/lib/ranking";
import { AdminAnalytics } from "@/components/dashboard/admin-analytics";
import { AdminClientPasswords } from "@/components/dashboard/admin-client-passwords";
import { AdminRoadside } from "@/components/dashboard/admin-roadside";
import { AdminEvents } from "@/components/dashboard/admin-events";
import { AdminCoworking } from "@/components/dashboard/admin-coworking";
import { AdminSolo } from "@/components/dashboard/admin-solo";
import { AdminRoadUpdates } from "@/components/dashboard/admin-road-updates";
import { AdminSafarnama } from "@/components/dashboard/admin-safarnama";
import { AdminRegoMap } from "@/components/dashboard/admin-rego-map";
import { AdminAbout } from "@/components/dashboard/admin-about";
import { AdminSubscription } from "@/components/dashboard/admin-subscription";
import { AdminExpeditions } from "@/components/dashboard/admin-expeditions";
import { AdminActivities } from "@/components/dashboard/admin-activities";
import {
  getPendingCompanies,
  getAllCompanies,
  getPendingPackages,
  getPendingTransports,
  getPendingGuides,
  getAllGuides,
  setCompanyStatus,
  setCompanyVerified,
  setCompanyFeatured,
  setPackageStatus,
  setTransportStatus,
  setGuideStatus,
  setGuideVerified,
  setGuideFeatured,
  type TourCompanyRow,
  type TourPackageRow,
  type TransportRow,
  type TourGuideRow,
} from "@/lib/tour-companies";
import {
  getPendingProviders,
  getAllProviders,
  getPendingServices,
  getPendingRentals,
  setProviderStatus,
  setProviderVerified,
  setProviderFeatured,
  setServiceStatus,
  setRentalStatus,
  type TransportProviderRow,
  type TransportServiceRow,
  type RentalVehicleRow,
} from "@/lib/transport";
import {
  getPendingMediaProviders,
  getAllMediaProviders,
  setMediaProviderStatus,
  setMediaProviderVerified,
  setMediaProviderFeatured,
  type MediaProviderRow,
} from "@/lib/media";
import {
  getPendingRestaurants,
  getAllRestaurants,
  setRestaurantStatus,
  setRestaurantVerified,
  setRestaurantFeatured,
  type RestaurantRow,
} from "@/lib/restaurants";
import {
  getPendingEdits,
  approvePendingEdit,
  rejectPendingEdit,
  type PendingEdit,
} from "@/lib/pending-edits";
import { armNotifications, notifyPing } from "@/lib/notify";
import {
  getAdminThreads,
  adminThreadId,
  type AdminThread,
} from "@/lib/messages";
import { ChatModal } from "@/components/chat/chat-modal";
import { MessagesInbox } from "@/components/chat/messages-inbox";
import { useUnread } from "@/lib/use-unread";
import { type BookingRow } from "@/lib/bookings";
import {
  getDestinationRows,
  createDestination,
  deleteDestination,
  slugify,
  type DestinationRow,
} from "@/lib/destinations";
import { type HotelRow, isSupabaseConfigured } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
import { useAuth } from "@/components/auth/auth-context";
import { cn, formatPrice, photo } from "@/lib/utils";

// Shared shape for hotels + homestays in the approvals/verification screens.
// Both HotelRow and HomestayRow satisfy this structurally.
interface PropertyRow {
  id: string;
  title: string;
  category_label: string;
  location: string;
  price: number;
  unit: string;
  image: string | null;
  description: string | null;
  amenities: string[] | null;
  gallery: string[] | null;
  owner_email: string | null;
  verified: boolean;
  featured: boolean;
  ranking_badge?: string | null;
  reg_number: string | null;
  owner_cnic: string | null;
  address: string | null;
  license_doc: string | null;
  owner_cnic_doc: string | null;
  ownership_doc: string | null;
  // Homestay-only (optional — hotels won't have these)
  house_rules?: string | null;
  cancellation_policy?: string | null;
  checkin_time?: string | null;
  checkout_time?: string | null;
}

/* Map tour entities into the shared PropertyRow shape for admin screens. */
function companyToProp(c: TourCompanyRow): PropertyRow {
  return {
    id: c.id,
    title: c.name,
    category_label: "Tour Company",
    location: c.location ?? "",
    price: 0,
    unit: "",
    image: c.cover_image ?? c.logo ?? null,
    description: c.description,
    amenities: c.service_areas,
    gallery: c.gallery,
    owner_email: c.owner_email,
    verified: c.verified,
    featured: c.featured,
    reg_number: c.reg_number,
    owner_cnic: c.owner_cnic,
    address: c.office_address,
    license_doc: c.license_doc,
    owner_cnic_doc: c.owner_cnic_doc,
    ownership_doc: c.ownership_doc,
  };
}
function packageToProp(p: TourPackageRow): PropertyRow {
  return {
    id: p.id,
    title: p.title,
    category_label: "Tour Package",
    location: p.destination ?? "",
    price: p.price_per_person,
    unit: "person",
    image: p.image,
    description: p.itinerary,
    amenities: p.included,
    gallery: p.images,
    owner_email: p.owner_email,
    verified: false,
    featured: false,
    reg_number: null,
    owner_cnic: null,
    address: null,
    license_doc: null,
    owner_cnic_doc: null,
    ownership_doc: null,
  };
}
function transportToProp(t: TransportRow): PropertyRow {
  return {
    id: t.id,
    title: t.name,
    category_label: `Transport · ${t.vehicle_type ?? ""}`,
    location: t.location ?? "",
    price: t.price_per_day,
    unit: "day",
    image: t.image,
    description: null,
    amenities: t.areas,
    gallery: t.images,
    owner_email: t.owner_email,
    verified: false,
    featured: false,
    reg_number: null,
    owner_cnic: null,
    address: null,
    license_doc: null,
    owner_cnic_doc: null,
    ownership_doc: null,
  };
}
function guideToProp(g: TourGuideRow): PropertyRow {
  const type = g.guide_type ?? g.specialization ?? "";
  return {
    id: g.id,
    title: g.name,
    category_label: `${g.company_id ? "Company" : "Independent"} Guide · ${type}`,
    location: g.location ?? g.city ?? "",
    price: g.price_per_day,
    unit: "day",
    image: g.image,
    description: g.bio,
    amenities: g.languages,
    gallery: g.gallery ?? null,
    owner_email: g.owner_email,
    verified: !!g.verified,
    featured: !!g.featured,
    reg_number: null,
    owner_cnic: g.cnic ?? null,
    address: g.address ?? null,
    license_doc: g.license_doc ?? null,
    owner_cnic_doc: g.cnic_doc ?? null,
    ownership_doc: null,
  };
}

/* Map transport entities into the shared PropertyRow shape. */
function providerToProp(p: TransportProviderRow): PropertyRow {
  return {
    id: p.id,
    title: p.name,
    category_label: `Transport Provider · ${p.business_type ?? ""}`,
    location: p.location ?? "",
    price: 0,
    unit: "",
    image: p.cover_image ?? p.logo ?? null,
    description: p.description,
    amenities: p.service_areas,
    gallery: null,
    owner_email: p.owner_email,
    verified: p.verified,
    featured: p.featured,
    reg_number: p.reg_number,
    owner_cnic: p.owner_cnic,
    address: p.address,
    license_doc: p.license_doc,
    owner_cnic_doc: p.owner_cnic_doc,
    ownership_doc: p.ownership_doc,
  };
}
function serviceToProp(s: TransportServiceRow): PropertyRow {
  return {
    id: s.id,
    title: s.title,
    category_label: `Transport Service · ${s.vehicle_type ?? ""}`,
    location: s.location ?? "",
    price: s.price_per_day || s.price_per_trip || 0,
    unit: s.price_per_day ? "day" : "trip",
    image: s.image,
    description: s.description,
    amenities: s.available_dates,
    gallery: s.images,
    owner_email: s.owner_email,
    verified: false,
    featured: false,
    reg_number: null,
    owner_cnic: null,
    address: null,
    license_doc: null,
    owner_cnic_doc: null,
    ownership_doc: null,
  };
}
function rentalToProp(r: RentalVehicleRow): PropertyRow {
  return {
    id: r.id,
    title: r.title,
    category_label: `Vehicle Rental · ${r.vehicle_type ?? ""}`,
    location: r.location ?? "",
    price: r.price_per_day,
    unit: "day",
    image: r.image,
    description: r.description,
    amenities: r.required_documents,
    gallery: r.images,
    owner_email: r.owner_email,
    verified: false,
    featured: false,
    reg_number: null,
    owner_cnic: null,
    address: null,
    license_doc: null,
    owner_cnic_doc: null,
    ownership_doc: null,
  };
}

function mediaToProp(m: MediaProviderRow): PropertyRow {
  return {
    id: m.id,
    title: m.name,
    category_label: `${m.company_id ? "Company" : "Independent"} ${m.service_type ?? "Media"}`,
    location: m.location ?? m.city ?? "",
    price: m.starting_price,
    unit: "shoot",
    image: m.cover_image ?? m.logo ?? null,
    description: m.bio,
    amenities: m.areas,
    gallery: null,
    owner_email: m.owner_email,
    verified: !!m.verified,
    featured: !!m.featured,
    reg_number: null,
    owner_cnic: m.cnic ?? null,
    address: null,
    license_doc: m.drone_license ?? null,
    owner_cnic_doc: m.cnic_doc ?? null,
    ownership_doc: null,
  };
}

function restaurantToProp(r: RestaurantRow): PropertyRow {
  return {
    id: r.id,
    title: r.name,
    category_label: `${r.property_id ? "Property" : "Independent"} Restaurant`,
    location: r.location ?? r.city ?? "",
    price: 0,
    unit: "",
    image: r.cover_image ?? r.logo ?? null,
    description: r.description,
    amenities: r.cuisine_types,
    gallery: r.gallery ?? null,
    owner_email: r.owner_email,
    verified: !!r.verified,
    featured: !!r.featured,
    reg_number: null,
    owner_cnic: r.owner_cnic ?? null,
    address: r.address ?? null,
    license_doc: r.license_doc ?? null,
    owner_cnic_doc: r.owner_cnic_doc ?? null,
    ownership_doc: null,
  };
}

type Tab =
  | "overview"
  | "analytics"
  | "clients"
  | "listings"
  | "add"
  | "approvals"
  | "edits"
  | "verification"
  | "roadside"
  | "road-updates"
  | "events"
  | "coworking"
  | "activities"
  | "solo"
  | "safarnama"
  | "regomap"
  | "messages"
  | "destinations"
  | "about"
  | "subscription"
  | "expeditions"
  | "users";

const nav: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "clients", label: "Password Update Clients", icon: KeyRound },
  { id: "listings", label: "Listings", icon: Building2 },
  { id: "add", label: "Add Listing", icon: PlusCircle },
  { id: "approvals", label: "Approvals", icon: ShieldCheck },
  { id: "edits", label: "Edit Requests", icon: Pencil },
  { id: "verification", label: "Verification", icon: BadgeCheck },
  { id: "roadside", label: "Roadside Assistance", icon: LifeBuoy },
  { id: "road-updates", label: "Road Updates & Alerts", icon: TriangleAlert },
  { id: "events", label: "Events & Expo", icon: CalendarDays },
  { id: "coworking", label: "Co-working Spaces", icon: Briefcase },
  { id: "activities", label: "Activities", icon: Mountain },
  { id: "solo", label: "Connect Solo Traveler", icon: Compass },
  { id: "safarnama", label: "Safarnama Stories", icon: BookOpen },
  { id: "regomap", label: "Rego Map", icon: MapPin },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "destinations", label: "Destinations", icon: MapPin },
  { id: "about", label: "About Page", icon: Info },
  { id: "subscription", label: "Subscription & Monetization", icon: BadgeCheck },
  { id: "expeditions", label: "Mountaineering & Expeditions", icon: Mountain },
  { id: "users", label: "Users", icon: Users },
];

const sampleUsers = [
  { name: "Ahmed Raza", email: "ahmed@example.com", role: "Traveler", city: "Lahore" },
  { name: "Shangrila Resort", email: "stay@shangrila.com", role: "Partner · Hotel", city: "Skardu" },
  { name: "Baltistan Rent a Car", email: "info@baltcar.com", role: "Partner · Transport", city: "Skardu" },
  { name: "Mountain Clicks", email: "hi@mclicks.com", role: "Partner · Photographer", city: "Skardu" },
  { name: "Sara Khan", email: "sara@example.com", role: "Traveler", city: "Karachi" },
];

export function AdminDashboard() {
  const [tab, setTab] = React.useState<Tab>("overview");
  const [pendingHotels, setPendingHotels] = React.useState<HotelRow[]>([]);
  const [added, setAdded] = React.useState<PartnerListing[]>([]);
  const [destRows, setDestRows] = React.useState<DestinationRow[]>([]);
  const [allHotels, setAllHotels] = React.useState<HotelRow[]>([]);
  const [pendingHomestays, setPendingHomestays] = React.useState<PropertyRow[]>([]);
  const [allHomestays, setAllHomestays] = React.useState<PropertyRow[]>([]);
  const [pendingHostels, setPendingHostels] = React.useState<PropertyRow[]>([]);
  const [allHostels, setAllHostels] = React.useState<PropertyRow[]>([]);
  const [pendingCompanies, setPendingCompanies] = React.useState<TourCompanyRow[]>([]);
  const [allCompanies, setAllCompanies] = React.useState<TourCompanyRow[]>([]);
  const [pendingPackages, setPendingPackages] = React.useState<TourPackageRow[]>([]);
  const [pendingTransports, setPendingTransports] = React.useState<TransportRow[]>([]);
  const [pendingGuides, setPendingGuides] = React.useState<TourGuideRow[]>([]);
  const [allGuides, setAllGuides] = React.useState<TourGuideRow[]>([]);
  const [pendingProviders, setPendingProviders] = React.useState<TransportProviderRow[]>([]);
  const [allProviders, setAllProviders] = React.useState<TransportProviderRow[]>([]);
  const [pendingServices, setPendingServices] = React.useState<TransportServiceRow[]>([]);
  const [pendingRentals, setPendingRentals] = React.useState<RentalVehicleRow[]>([]);
  const [pendingMedia, setPendingMedia] = React.useState<MediaProviderRow[]>([]);
  const [allMedia, setAllMedia] = React.useState<MediaProviderRow[]>([]);
  const [pendingRestaurants, setPendingRestaurants] = React.useState<RestaurantRow[]>([]);
  const [allRestaurants, setAllRestaurants] = React.useState<RestaurantRow[]>([]);
  const [pendingEdits, setPendingEdits] = React.useState<PendingEdit[]>([]);
  const [adminThreads, setAdminThreads] = React.useState<AdminThread[]>([]);
  const [chatThread, setChatThread] = React.useState<BookingRow | null>(null);
  const [newOwnerEmail, setNewOwnerEmail] = React.useState("");
  const { user, ready, logout } = useAuth();
  const router = useRouter();

  const refresh = React.useCallback(async () => {
    setAdded(listAll());
    setPendingHotels(await getPendingHotels());
    setDestRows(await getDestinationRows());
    const aHotels = await getAllHotels();
    setAllHotels(aHotels);
    setPendingHomestays((await getPendingHomestays()) as PropertyRow[]);
    const aHomestays = (await getAllHomestays()) as PropertyRow[];
    setAllHomestays(aHomestays);
    setPendingHostels((await getPendingHostels()) as PropertyRow[]);
    const aHostels = (await getAllHostels()) as PropertyRow[];
    setAllHostels(aHostels);
    setPendingCompanies(await getPendingCompanies());
    const aCompanies = await getAllCompanies();
    setAllCompanies(aCompanies);
    setPendingPackages(await getPendingPackages());
    setPendingTransports(await getPendingTransports());
    setPendingGuides(await getPendingGuides());
    const aGuides = await getAllGuides();
    setAllGuides(aGuides);
    setPendingProviders(await getPendingProviders());
    const aProviders = await getAllProviders();
    setAllProviders(aProviders);
    setPendingServices(await getPendingServices());
    setPendingRentals(await getPendingRentals());
    setPendingMedia(await getPendingMediaProviders());
    const aMedia = await getAllMediaProviders();
    setAllMedia(aMedia);
    setPendingRestaurants(await getPendingRestaurants());
    const aRestaurants = await getAllRestaurants();
    setAllRestaurants(aRestaurants);
    setPendingEdits(await getPendingEdits());
    // Owner emails across every module → resolve admin↔owner threads.
    const ownerEmails = Array.from(
      new Set(
        [
          ...aHotels,
          ...aHomestays,
          ...aCompanies,
          ...aGuides,
          ...aProviders,
          ...aMedia,
        ]
          .map((x) => (x as { owner_email?: string | null }).owner_email ?? "")
          .filter(Boolean)
      )
    );
    setAdminThreads(await getAdminThreads(ownerEmails));
  }, []);

  // Hotels + homestays + tour items combined for the approvals screen.
  const pendingProperties: PropertyRow[] = [
    ...(pendingHotels as PropertyRow[]),
    ...pendingHomestays,
    ...pendingHostels,
    ...pendingCompanies.map(companyToProp),
    ...pendingPackages.map(packageToProp),
    ...pendingTransports.map(transportToProp),
    ...pendingGuides.map(guideToProp),
    ...pendingProviders.map(providerToProp),
    ...pendingServices.map(serviceToProp),
    ...pendingRentals.map(rentalToProp),
    ...pendingMedia.map(mediaToProp),
    ...pendingRestaurants.map(restaurantToProp),
  ];
  // Verification only applies to entities with documents
  // (hotels/homestays/companies/transport providers).
  const allProperties: PropertyRow[] = [
    ...(allHotels as PropertyRow[]),
    ...allHomestays,
    ...allHostels,
    ...allCompanies.map(companyToProp),
    ...allProviders.map(providerToProp),
    ...allGuides.map(guideToProp),
    ...allMedia.map(mediaToProp),
    ...allRestaurants.map(restaurantToProp),
  ];
  React.useEffect(() => {
    refresh();
    // Poll so new approvals / edit requests surface (and alert) without reload.
    const t = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 45000);
    return () => clearInterval(t);
  }, [refresh]);

  // Arm sound + desktop notifications once (after first gesture).
  React.useEffect(() => {
    armNotifications();
  }, []);

  // Alert the admin when new edit requests or approvals arrive.
  const prevEdits = React.useRef<number | null>(null);
  React.useEffect(() => {
    const n = pendingEdits.length;
    if (prevEdits.current !== null && n > prevEdits.current) {
      notifyPing(
        `New edit request from a provider — ${n} awaiting review`
      );
    }
    prevEdits.current = n;
  }, [pendingEdits]);

  const prevApprovals = React.useRef<number | null>(null);
  React.useEffect(() => {
    const n = pendingProperties.length;
    if (prevApprovals.current !== null && n > prevApprovals.current) {
      notifyPing(`New listing pending approval — ${n} awaiting review`);
    }
    prevApprovals.current = n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingProperties.length]);

  // Admin ↔ owner message threads.
  const threadRows: BookingRow[] = adminThreads.map(
    (t) =>
      ({
        id: t.threadId,
        hotel_title: "Provider",
        customer_email: t.ownerEmail,
        customer_name: t.ownerEmail,
      }) as unknown as BookingRow
  );
  const { unread: msgUnread, markSeen: markMsgSeen } = useUnread(
    adminThreads.map((t) => t.threadId),
    user?.email ?? ""
  );
  const openThread = (b: BookingRow) => {
    markMsgSeen(b.id);
    setChatThread(b);
  };
  const startThreadWith = (email: string) => {
    const e = email.trim().toLowerCase();
    if (!e) return;
    setChatThread({
      id: adminThreadId(e),
      hotel_title: "Provider",
      customer_email: e,
      customer_name: e,
    } as unknown as BookingRow);
  };

  // Open a thread when the admin clicks its navbar notification.
  React.useEffect(() => {
    const tryOpen = (id: string | null) => {
      if (!id) return;
      const t = adminThreads.find((x) => x.threadId === id);
      if (!t) return;
      try {
        localStorage.removeItem("safarigb_open_chat");
      } catch {
        /* ignore */
      }
      markMsgSeen(id);
      setChatThread({
        id,
        hotel_title: "Provider",
        customer_email: t.ownerEmail,
        customer_name: t.ownerEmail,
      } as unknown as BookingRow);
    };
    try {
      tryOpen(localStorage.getItem("safarigb_open_chat"));
    } catch {
      /* ignore */
    }
    const handler = (e: Event) => tryOpen((e as CustomEvent<string>).detail);
    window.addEventListener("safarigb:open-chat", handler);
    return () => window.removeEventListener("safarigb:open-chat", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminThreads]);

  React.useEffect(() => {
    if (ready && (!user || user.role !== "admin")) router.replace("/signin");
  }, [ready, user, router]);

  if (!ready || !user || user.role !== "admin") {
    return (
      <div className="container-px py-24 text-center text-muted-foreground">
        Loading admin…
      </div>
    );
  }

  const isHotelId = (id: string) => allHotels.some((h) => h.id === id);
  const isHomestayId = (id: string) => allHomestays.some((h) => h.id === id);
  const isHostelId = (id: string) => allHostels.some((h) => h.id === id);
  const isProviderId = (id: string) => allProviders.some((p) => p.id === id);
  const isGuideId = (id: string) => allGuides.some((g) => g.id === id);
  const isMediaId = (id: string) => allMedia.some((m) => m.id === id);
  const isRestaurantId = (id: string) => allRestaurants.some((r) => r.id === id);
  const act = async (id: string, status: "approved" | "rejected") => {
    if (pendingHotels.some((h) => h.id === id)) await setHotelStatus(id, status);
    else if (pendingHomestays.some((h) => h.id === id))
      await setHomestayStatus(id, status);
    else if (pendingHostels.some((h) => h.id === id))
      await setHostelStatus(id, status);
    else if (pendingCompanies.some((c) => c.id === id))
      await setCompanyStatus(id, status);
    else if (pendingPackages.some((p) => p.id === id))
      await setPackageStatus(id, status);
    else if (pendingTransports.some((t) => t.id === id))
      await setTransportStatus(id, status);
    else if (pendingGuides.some((g) => g.id === id))
      await setGuideStatus(id, status);
    else if (pendingProviders.some((p) => p.id === id))
      await setProviderStatus(id, status);
    else if (pendingServices.some((s) => s.id === id))
      await setServiceStatus(id, status);
    else if (pendingRentals.some((r) => r.id === id))
      await setRentalStatus(id, status);
    else if (pendingMedia.some((m) => m.id === id))
      await setMediaProviderStatus(id, status);
    else if (pendingRestaurants.some((r) => r.id === id))
      await setRestaurantStatus(id, status);
    await refresh();
  };
  const verify = async (id: string, verified: boolean) => {
    if (isHotelId(id)) await setHotelVerified(id, verified);
    else if (isHomestayId(id)) await setHomestayVerified(id, verified);
    else if (isHostelId(id)) await setHostelVerified(id, verified);
    else if (isProviderId(id)) await setProviderVerified(id, verified);
    else if (isGuideId(id)) await setGuideVerified(id, verified);
    else if (isMediaId(id)) await setMediaProviderVerified(id, verified);
    else if (isRestaurantId(id)) await setRestaurantVerified(id, verified);
    else await setCompanyVerified(id, verified);
    await refresh();
  };
  const feature = async (id: string, featured: boolean) => {
    if (isHotelId(id)) await setHotelFeatured(id, featured);
    else if (isHomestayId(id)) await setHomestayFeatured(id, featured);
    else if (isHostelId(id)) await setHostelFeatured(id, featured);
    else if (isProviderId(id)) await setProviderFeatured(id, featured);
    else if (isGuideId(id)) await setGuideFeatured(id, featured);
    else if (isMediaId(id)) await setMediaProviderFeatured(id, featured);
    else if (isRestaurantId(id)) await setRestaurantFeatured(id, featured);
    else await setCompanyFeatured(id, featured);
    await refresh();
  };
  const setRanking = async (id: string, badge: string) => {
    const table = isHotelId(id)
      ? "hotels"
      : isHomestayId(id)
        ? "homestays"
        : isProviderId(id)
          ? "transport_providers"
          : isGuideId(id)
            ? "tour_guides"
            : isMediaId(id)
              ? "media_providers"
              : isRestaurantId(id)
                ? "restaurants"
                : "tour_companies";
    await setRankingBadge(table, id, badge);
    await refresh();
  };
  const approveEdit = async (table: string, id: string) => {
    await approvePendingEdit(table, id);
    await refresh();
  };
  const rejectEdit = async (table: string, id: string) => {
    await rejectPendingEdit(table, id);
    await refresh();
  };

  const handleSignOut = () => {
    logout();
    router.push("/");
  };

  return (
    <div className="container-px py-10">
      <div className="flex items-center gap-2">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-forest text-gold shadow-premium">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <h1 className="font-display text-3xl font-bold text-forest">
          Admin Dashboard
        </h1>
      </div>
      <p className="mt-1 text-muted-foreground">
        Platform overview, listings, approvals and users.{" "}
        <span className="text-xs italic">(Demo view)</span>
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        {/* Sidebar */}
        <aside>
          <div className="sticky top-24 rounded-3xl border border-border/70 bg-card p-3 shadow-premium">
            <nav className="space-y-1">
              {nav.map((n) => {
                const Icon = n.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => setTab(n.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                      tab === n.id
                        ? "bg-gradient-forest text-white shadow-premium"
                        : "text-forest hover:bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {n.label}
                    {n.id === "approvals" && pendingProperties.length > 0 && (
                      <span className="ml-auto rounded-full bg-gold px-2 text-[10px] font-bold text-forest-900">
                        {pendingProperties.length}
                      </span>
                    )}
                    {n.id === "edits" && pendingEdits.length > 0 && (
                      <span className="ml-auto rounded-full bg-gold px-2 text-[10px] font-bold text-forest-900">
                        {pendingEdits.length}
                      </span>
                    )}
                    {n.id === "messages" && msgUnread.size > 0 && (
                      <span className="ml-auto rounded-full bg-red-500 px-2 text-[10px] font-bold text-white">
                        {msgUnread.size}
                      </span>
                    )}
                  </button>
                );
              })}
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-forest hover:bg-muted"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </nav>
          </div>
        </aside>

        {/* Content */}
        <div>
          {tab === "analytics" && <AdminAnalytics />}

          {tab === "clients" && <AdminClientPasswords />}

          {tab === "overview" && (
            <Overview pending={pendingProperties.length} added={added.length} />
          )}
          {tab === "listings" && (
            <ListingsTable
              added={added}
              onDelete={(l) => {
                removeListing(l.ownerEmail, l.id);
                refresh();
              }}
            />
          )}
          {tab === "add" && (
            <AddListingAdmin
              onAdded={() => {
                refresh();
                setTab("listings");
              }}
            />
          )}
          {tab === "approvals" && (
            <Approvals items={pendingProperties} onAct={act} />
          )}
          {tab === "edits" && (
            <PendingEditsAdmin
              edits={pendingEdits}
              onApprove={approveEdit}
              onReject={rejectEdit}
            />
          )}
          {tab === "verification" && (
            <VerificationAdmin
              items={allProperties}
              onToggle={verify}
              onFeature={feature}
              onRanking={setRanking}
            />
          )}
          {tab === "roadside" && <AdminRoadside />}
          {tab === "road-updates" && <AdminRoadUpdates />}
          {tab === "events" && <AdminEvents />}
          {tab === "coworking" && <AdminCoworking />}
          {tab === "solo" && <AdminSolo />}
          {tab === "safarnama" && <AdminSafarnama />}
          {tab === "regomap" && <AdminRegoMap />}
          {tab === "activities" && <AdminActivities />}
          {tab === "messages" && (
            <div className="space-y-5">
              <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
                <h2 className="font-display text-xl font-bold text-forest">
                  Message a provider
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Start a conversation with any owner by their account email.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={newOwnerEmail}
                    onChange={(e) => setNewOwnerEmail(e.target.value)}
                    placeholder="owner@email.com"
                    className="auth-input flex-1"
                  />
                  <Button
                    variant="gold"
                    className="rounded-lg"
                    onClick={() => {
                      startThreadWith(newOwnerEmail);
                      setNewOwnerEmail("");
                    }}
                  >
                    <MessageSquare className="h-4 w-4" /> Open chat
                  </Button>
                </div>
              </div>
              <MessagesInbox
                bookings={threadRows}
                unread={msgUnread}
                otherLabelFor={(b) => b.customer_email}
                onOpen={openThread}
              />
            </div>
          )}
          {tab === "destinations" && (
            <DestinationsAdmin rows={destRows} onChange={refresh} />
          )}
          {tab === "about" && <AdminAbout />}
          {tab === "subscription" && <AdminSubscription />}
          {tab === "expeditions" && <AdminExpeditions />}
          {tab === "users" && <UsersTable />}
        </div>
      </div>

      {chatThread && (
        <ChatModal
          booking={chatThread}
          currentEmail={user.email}
          currentName="Rego Admin"
          otherLabel={chatThread.customer_email}
          onSeen={() => markMsgSeen(chatThread.id)}
          onClose={() => setChatThread(null)}
        />
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium transition-all hover:-translate-y-0.5 hover:shadow-premium-lg">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-forest text-gold shadow-premium">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-4 font-display text-3xl font-bold text-forest">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function Overview({ pending, added }: { pending: number; added: number }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Building2}
          label="Total listings"
          value={String(listings.length + added)}
        />
        <StatCard icon={Users} label="Registered users" value="1,284" />
        <StatCard icon={CalendarCheck} label="Bookings (30d)" value="412" />
        <StatCard icon={Wallet} label="Revenue (30d)" value={formatPrice(3850000)} />
      </div>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-premium">
        <h2 className="font-display text-lg font-bold text-forest">
          Pending approvals
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {pending > 0
            ? `${pending} partner listings are waiting for review.`
            : "All caught up — no listings pending."}
        </p>
      </div>
    </div>
  );
}

function ListingsTable({
  added,
  onDelete,
}: {
  added: PartnerListing[];
  onDelete: (l: PartnerListing) => void;
}) {
  const [q, setQ] = React.useState("");
  const match = (l: { title?: string; location?: string; category?: string }) => {
    if (!q.trim()) return true;
    const t = q.trim().toLowerCase();
    return (
      (l.title ?? "").toLowerCase().includes(t) ||
      (l.location ?? "").toLowerCase().includes(t) ||
      (getCategory(l.category as never)?.name ?? "").toLowerCase().includes(t)
    );
  };
  const addedRows = added.filter(match);
  const listingRows = listings.filter(match);
  return (
    <div className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-premium">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, category or location…"
          className="w-full bg-transparent text-sm focus:outline-none"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Listing</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">Location</th>
              <th className="px-4 py-3 font-semibold">Price</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {q.trim() && addedRows.length === 0 && listingRows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No listings match your search.</td></tr>
            )}
            {addedRows.map((l) => (
              <tr key={l.id} className="border-b border-border bg-gold/5 last:border-0">
                <td className="px-4 py-3 font-medium text-forest">{l.title}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {getCategory(l.category)?.name}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{l.location}</td>
                <td className="px-4 py-3 font-semibold text-forest">
                  {formatPrice(l.price)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-gold-700">
                      New
                    </span>
                    <button
                      onClick={() => onDelete(l)}
                      aria-label="Delete"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {listingRows.map((l) => (
              <tr key={l.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/listings/${l.id}`}
                    className="font-medium text-forest hover:text-gold"
                  >
                    {l.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {getCategory(l.category)?.name}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{l.location}</td>
                <td className="px-4 py-3 font-semibold text-forest">
                  {formatPrice(l.price)}
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1 text-forest">
                    <Star className="h-3.5 w-3.5 fill-gold text-gold" />
                    {l.rating.toFixed(1)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminAddField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-forest">
        {label} {required && <span className="text-gold-600">*</span>}
      </span>
      {children}
    </label>
  );
}

function AddListingAdmin({ onAdded }: { onAdded: () => void }) {
  const [category, setCategory] = React.useState<CategorySlug>("hotels");
  const [title, setTitle] = React.useState("");
  const [owner, setOwner] = React.useState("");
  const [location, setLocation] = React.useState<string>(locations[0]);
  const [price, setPrice] = React.useState("");
  const [unit, setUnit] = React.useState("night");
  const [description, setDescription] = React.useState("");
  const [image, setImage] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [error, setError] = React.useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const priceNum = Number(price);
    if (!title.trim() || !priceNum) {
      setError("Please add a title and a valid price.");
      return;
    }
    addListing({
      ownerEmail: owner.trim() || "admin@rego.com",
      title: title.trim(),
      category,
      location,
      price: priceNum,
      unit: unit.trim() || "night",
      description: description.trim(),
      image:
        image.trim() ||
        `https://picsum.photos/seed/${category}-${
          Math.floor(Math.random() * 90) + 70
        }/900/600`,
      phone: phone.trim() || undefined,
    });
    onAdded();
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-premium sm:p-8"
    >
      <div>
        <h2 className="font-display text-xl font-bold text-forest">
          Add a listing (any category)
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a listing on behalf of a provider who needs help getting set up.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <AdminAddField label="Listing title" required>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Snow Peak Guesthouse"
            className="auth-input"
          />
        </AdminAddField>
        <AdminAddField label="Category" required>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CategorySlug)}
            className="auth-input"
          >
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </AdminAddField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <AdminAddField label="Provider / owner email">
          <input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="owner@example.com (optional)"
            className="auth-input"
          />
        </AdminAddField>
        <AdminAddField label="Location" required>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="auth-input"
          >
            {locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </AdminAddField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <AdminAddField label="Price (PKR)" required>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="25000"
            className="auth-input"
          />
        </AdminAddField>
        <AdminAddField label="Per (unit)">
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="night / day / person"
            className="auth-input"
          />
        </AdminAddField>
      </div>

      <AdminAddField label="Description">
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description of the service…"
          className="auth-input resize-none"
        />
      </AdminAddField>

      <div className="grid gap-4 sm:grid-cols-2">
        <AdminAddField label="Image URL (optional)">
          <input
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="https://… (blank = default image)"
            className="auth-input"
          />
        </AdminAddField>
        <AdminAddField label="Phone / WhatsApp">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+92 3xx xxxxxxx"
            className="auth-input"
          />
        </AdminAddField>
      </div>

      <Button type="submit" variant="gold" size="lg" className="w-full rounded-lg">
        Publish listing
      </Button>
    </form>
  );
}

function PendingEditsAdmin({
  edits,
  onApprove,
  onReject,
}: {
  edits: PendingEdit[];
  onApprove: (table: string, id: string) => void;
  onReject: (table: string, id: string) => void;
}) {
  if (edits.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-muted/40 py-16 text-center">
        <Pencil className="mx-auto h-10 w-10 text-forest-600" />
        <p className="mt-2 font-display text-lg font-semibold text-forest">
          No edit requests
        </p>
        <p className="text-sm text-muted-foreground">
          When an approved listing is edited, the changes wait here for your
          approval before going live.
        </p>
      </div>
    );
  }
  return (
    <div>
      <h2 className="font-display text-xl font-bold text-forest">Edit requests</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        These approved listings have edits awaiting your review. The current
        version stays live until you approve the changes.
      </p>
      <div className="mt-5 space-y-3">
        {edits.map((e) => (
          <div key={`${e.table}-${e.id}`} className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="rounded-full bg-forest-50 px-2.5 py-0.5 text-[10px] font-bold uppercase text-forest-600">
                  {e.label}
                </span>
                <p className="mt-1 font-display text-base font-semibold text-forest">{e.title}</p>
                {e.pending_at && (
                  <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> Submitted {new Date(e.pending_at).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => onApprove(e.table, e.id)} className="flex items-center gap-1.5 rounded-xl bg-gradient-forest px-3.5 py-2 text-sm font-semibold text-white shadow-soft hover:-translate-y-0.5">
                  <CheckCircle2 className="h-4 w-4" /> Approve changes
                </button>
                <button onClick={() => onReject(e.table, e.id)} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                  <XCircle className="h-4 w-4" /> Discard
                </button>
              </div>
            </div>
            {e.changes.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No visible field changes (media/booking settings).</p>
            ) : (
              <div className="mt-3 overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Field</th>
                      <th className="px-3 py-2">Current</th>
                      <th className="px-3 py-2"></th>
                      <th className="px-3 py-2">New</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.changes.map((c) => (
                      <tr key={c.field} className="border-t border-border align-top">
                        <td className="px-3 py-2 font-medium text-forest">{c.field.replace(/_/g, " ")}</td>
                        <td className="px-3 py-2 text-muted-foreground line-through">{String(c.from)}</td>
                        <td className="px-3 py-2 text-forest-600"><ArrowRight className="h-4 w-4" /></td>
                        <td className="px-3 py-2 font-medium text-forest">{String(c.to)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Approvals({
  items,
  onAct,
}: {
  items: PropertyRow[];
  onAct: (id: string, status: "approved" | "rejected") => void;
}) {
  const [openId, setOpenId] = React.useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-muted/40 py-16 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-forest-600" />
        <p className="mt-2 font-display text-lg font-semibold text-forest">
          All caught up
        </p>
        <p className="text-sm text-muted-foreground">
          No properties waiting for approval.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Review each property&apos;s details and documents, then approve or reject.
      </p>
      {items.map((a) => {
        const open = openId === a.id;
        const gallery = (a.gallery ?? []).filter(Boolean);
        return (
          <div
            key={a.id}
            className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-premium"
          >
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo(a.image)}
                  alt={a.title}
                  className="h-14 w-14 rounded-xl object-cover"
                />
                <div>
                  <h3 className="font-display text-base font-semibold text-forest">
                    {a.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {a.category_label} · {a.location} · {formatPrice(a.price)}/
                    {a.unit}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    by {a.owner_email ?? "unknown"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setOpenId(open ? null : a.id)}
                  className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-forest hover:bg-muted"
                >
                  <Eye className="h-4 w-4" /> {open ? "Hide" : "Review"} details
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      open && "rotate-180"
                    )}
                  />
                </button>
                <button
                  onClick={() => onAct(a.id, "approved")}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-forest px-3.5 py-2 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5"
                >
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </button>
                <button
                  onClick={() => onAct(a.id, "rejected")}
                  className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4" /> Reject
                </button>
              </div>
            </div>

            {open && (
              <div className="space-y-5 border-t border-border bg-muted/20 p-4 sm:p-5">
                {a.description && (
                  <div>
                    <DetailLabel>Description</DetailLabel>
                    <p className="mt-1 text-sm leading-relaxed text-forest/90">
                      {a.description}
                    </p>
                  </div>
                )}

                <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  {a.address && <KV k="Address" v={a.address} />}
                  {a.checkin_time && <KV k="Check-in" v={a.checkin_time} />}
                  {a.checkout_time && <KV k="Check-out" v={a.checkout_time} />}
                </div>

                {a.amenities && a.amenities.length > 0 && (
                  <div>
                    <DetailLabel>Amenities</DetailLabel>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {a.amenities.map((am) => (
                        <span
                          key={am}
                          className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-forest/80 ring-1 ring-border"
                        >
                          {am}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {(a.house_rules || a.cancellation_policy) && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {a.house_rules && (
                      <div>
                        <DetailLabel>House rules</DetailLabel>
                        <p className="mt-1 whitespace-pre-line text-sm text-forest/90">
                          {a.house_rules}
                        </p>
                      </div>
                    )}
                    {a.cancellation_policy && (
                      <div>
                        <DetailLabel>Cancellation policy</DetailLabel>
                        <p className="mt-1 whitespace-pre-line text-sm text-forest/90">
                          {a.cancellation_policy}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {gallery.length > 0 && (
                  <div>
                    <DetailLabel>Gallery</DetailLabel>
                    <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {gallery.map((src, i) => (
                        <a
                          key={i}
                          href={src}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block h-20 overflow-hidden rounded-lg border border-border"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo(src)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <DetailLabel>Verification</DetailLabel>
                  <div className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    <KV k="Reg / license #" v={a.reg_number || "—"} />
                    <KV k="Owner CNIC" v={a.owner_cnic || "—"} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <DocThumb label="Certificate / license" url={a.license_doc} />
                    <DocThumb label="Owner ID" url={a.owner_cnic_doc} />
                    <DocThumb label="Ownership proof" url={a.ownership_doc} />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DetailLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <p>
      <span className="text-muted-foreground">{k}: </span>
      <span className="font-medium text-forest">{v}</span>
    </p>
  );
}

function DocThumb({ label, url }: { label: string; url: string | null }) {
  if (!url) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-center">
        <FileText className="mx-auto h-5 w-5 text-muted-foreground" />
        <p className="mt-1 text-[11px] font-medium text-forest">{label}</p>
        <p className="text-[10px] text-muted-foreground">Not provided</p>
      </div>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block overflow-hidden rounded-lg border border-border"
    >
      <div className="h-24 w-full overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={label}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
      </div>
      <p className="px-2 py-1 text-[11px] font-medium text-forest">{label}</p>
    </a>
  );
}

function VerificationAdmin({
  items,
  onToggle,
  onFeature,
  onRanking,
}: {
  items: PropertyRow[];
  onToggle: (id: string, verified: boolean) => void;
  onFeature: (id: string, featured: boolean) => void;
  onRanking: (id: string, badge: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 py-16 text-center">
        <BadgeCheck className="mx-auto h-10 w-10 text-forest-600" />
        <p className="mt-2 font-display text-lg font-semibold text-forest">
          No properties to verify
        </p>
        <p className="text-sm text-muted-foreground">
          Properties submitted by providers will appear here for document
          review.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {items.map((h) => (
        <div
          key={h.id}
          className="rounded-2xl border border-border bg-card p-4 shadow-premium sm:p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-semibold text-forest">
                  {h.title}
                </h3>
                {h.verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-forest-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    <BadgeCheck className="h-3 w-3" /> Verified
                  </span>
                ) : (
                  <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold-700">
                    Unverified
                  </span>
                )}
                {h.featured && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gradient-gold px-2 py-0.5 text-[10px] font-bold text-forest-900">
                    <Star className="h-3 w-3" /> Featured
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {h.location} · by {h.owner_email ?? "unknown"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                defaultValue={h.ranking_badge ?? ""}
                onChange={(e) => onRanking(h.id, e.target.value)}
                aria-label="Ranking badge"
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-forest focus:outline-none"
              >
                {RANKING_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o === "" ? "No badge" : o}
                  </option>
                ))}
              </select>
              <button
                onClick={() => onFeature(h.id, !h.featured)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold",
                  h.featured
                    ? "border border-border text-forest hover:bg-muted"
                    : "bg-gradient-gold text-forest-900 shadow-soft hover:-translate-y-0.5"
                )}
              >
                <Star className={cn("h-4 w-4", h.featured && "fill-gold")} />
                {h.featured ? "Unfeature" : "Feature"}
              </button>
              <button
                onClick={() => onToggle(h.id, !h.verified)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold",
                  h.verified
                    ? "border border-border text-red-600 hover:bg-red-50"
                    : "bg-gradient-forest text-white shadow-soft hover:-translate-y-0.5"
                )}
              >
                {h.verified ? (
                  <>
                    <XCircle className="h-4 w-4" /> Revoke
                  </>
                ) : (
                  <>
                    <BadgeCheck className="h-4 w-4" /> Mark verified
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Reg / license #: </span>
              <span className="font-medium text-forest">
                {h.reg_number || "—"}
              </span>
            </p>
            <p>
              <span className="text-muted-foreground">Owner CNIC: </span>
              <span className="font-medium text-forest">
                {h.owner_cnic || "—"}
              </span>
            </p>
            {h.address && (
              <p className="sm:col-span-2">
                <span className="text-muted-foreground">Address: </span>
                <span className="font-medium text-forest">{h.address}</span>
              </p>
            )}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <DocThumb label="Certificate / license" url={h.license_doc} />
            <DocThumb label="Owner ID" url={h.owner_cnic_doc} />
            <DocThumb label="Ownership proof" url={h.ownership_doc} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DestinationsAdmin({
  rows,
  onChange,
}: {
  rows: DestinationRow[];
  onChange: () => void;
}) {
  const [name, setName] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [stays, setStays] = React.useState("");
  const [tagline, setTagline] = React.useState("");
  const [image, setImage] = React.useState("");
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const slug = slugify(name);

  const reset = () => {
    setName("");
    setLocation("");
    setStays("");
    setTagline("");
    setImage("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !location.trim()) {
      setError("Please enter at least a name and a location.");
      return;
    }
    if (!slug) {
      setError("Please enter a valid destination name.");
      return;
    }
    setSaving(true);
    const { error: dbError } = await createDestination({
      slug,
      name: name.trim(),
      location: location.trim(),
      stays: stays.trim() || null,
      tagline: tagline.trim() || null,
      image:
        image.trim() ||
        `https://picsum.photos/seed/${slugify(location) || "gb"}-dest/1200/700`,
    });
    setSaving(false);
    if (dbError) {
      setError(
        dbError.message.includes("duplicate")
          ? "A destination with this name already exists."
          : dbError.message
      );
      return;
    }
    reset();
    onChange();
  };

  const handleDelete = async (id: string, label: string) => {
    if (!window.confirm(`Delete "${label}"? This can't be undone.`)) return;
    await deleteDestination(id);
    onChange();
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-8 text-center">
        <MapPin className="mx-auto h-10 w-10 text-forest-600" />
        <p className="mt-2 font-display text-lg font-semibold text-forest">
          Connect the database to manage destinations
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Add your Supabase keys to <code>.env.local</code> and run{" "}
          <code>supabase/phase10-destinations.sql</code> to enable adding,
          editing and removing destinations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Add form */}
      <form
        onSubmit={submit}
        className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-premium sm:p-8"
      >
        <div>
          <h2 className="font-display text-xl font-bold text-forest">
            Add a destination
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            New destinations appear on the homepage and get their own page.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <AdminAddField label="Destination name" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Astore Valley"
              className="auth-input"
            />
            {name.trim() && (
              <span className="mt-1 block text-xs text-muted-foreground">
                Page URL: /destinations/{slug || "…"}
              </span>
            )}
          </AdminAddField>
          <AdminAddField label="Location (for filtering)" required>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              list="gb-locations"
              placeholder="e.g. Astore"
              className="auth-input"
            />
            <datalist id="gb-locations">
              {locations.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </AdminAddField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <AdminAddField label="Stays label">
            <input
              value={stays}
              onChange={(e) => setStays(e.target.value)}
              placeholder="e.g. 40+ Stays"
              className="auth-input"
            />
          </AdminAddField>
          <AdminAddField label="Tagline">
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="e.g. Alpine lakes and meadows"
              className="auth-input"
            />
          </AdminAddField>
        </div>

        <AdminAddField label="Cover image">
          <ImageUpload value={image} onChange={setImage} />
          <input
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="…or paste an image URL (blank = auto image)"
            className="auth-input mt-2"
          />
        </AdminAddField>

        <Button
          type="submit"
          variant="gold"
          size="lg"
          disabled={saving}
          className="w-full rounded-lg"
        >
          {saving ? "Saving…" : "Add destination"}
        </Button>
      </form>

      {/* Existing destinations */}
      <div>
        <h3 className="mb-3 font-display text-lg font-bold text-forest">
          Current destinations{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({rows.length})
          </span>
        </h3>
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 py-12 text-center text-sm text-muted-foreground">
            No destinations yet. Add your first one above.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {rows.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-premium"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo(d.image)}
                  alt={d.name}
                  className="h-16 w-20 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="truncate font-display text-base font-semibold text-forest">
                    {d.name}
                  </h4>
                  <p className="truncate text-xs text-muted-foreground">
                    {d.location}
                    {d.stays ? ` · ${d.stays}` : ""}
                  </p>
                  <Link
                    href={`/destinations/${d.slug}`}
                    className="text-xs font-medium text-forest-600 hover:text-gold"
                  >
                    /destinations/{d.slug}
                  </Link>
                </div>
                <button
                  onClick={() => handleDelete(d.id, d.name)}
                  aria-label={`Delete ${d.name}`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UsersTable() {
  return (
    <div className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-premium">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">City</th>
            </tr>
          </thead>
          <tbody>
            {sampleUsers.map((u) => (
              <tr key={u.email} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-forest">{u.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-forest-50 px-2.5 py-0.5 text-xs font-semibold text-forest-600">
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.city}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
