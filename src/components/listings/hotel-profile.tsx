"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Star,
  MapPin,
  ShieldCheck,
  Check,
  Users,
  BedDouble,
  ChevronLeft,
  CalendarRange,
  Car,
  Wifi,
  UtensilsCrossed,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ListingDetailHeader } from "@/components/listings/listing-detail-header";
import {
  ProfileGallery,
  GalleryGrid,
  HERO_PHOTO_COUNT,
  RoomPhotos,
} from "@/components/listings/profile-gallery";
import { FeatureCards, type FeatureItem } from "@/components/listings/feature-cards";
import { RoomDetails } from "@/components/listings/room-details";
import { PaymentPanel } from "@/components/payments/payment-panel";
import { paymentConfigFrom, type PaymentConfig } from "@/lib/payments";
import { type Listing } from "@/lib/data";
import { useAuth } from "@/components/auth/auth-context";
import {
  createBooking,
  bookingRef,
  hasAcceptedBooking,
  setBookingStatus,
} from "@/lib/bookings";
import {
  sendEmail,
  bookingConfirmedEmailToOwner,
  bookingStatusEmail,
} from "@/lib/email";
import {
  num,
  savePendingBooking,
  signupHref,
  str,
  useResumeBooking,
} from "@/lib/pending-booking";
import { isUuid, getRoomBookedUnits, addBookingRoom } from "@/lib/hotels";
import { useWishlist } from "@/lib/wishlist";
import {
  getReviews,
  addReview,
  notifyProviderOfReview,
  type ReviewRow,
} from "@/lib/reviews";
import { ReviewCard } from "@/components/listings/reviews-section";
import { sendBookingNotification } from "@/lib/messages";
import { cn, formatPrice, realGallery } from "@/lib/utils";


const tabs = [
  { id: "about", label: "About" },
  { id: "rooms", label: "Rooms" },
  { id: "gallery", label: "Gallery" },
  { id: "reviews", label: "Reviews" },
  { id: "location", label: "Location" },
];


function buildRooms(listing: Listing) {
  const base = listing.price;
  return [
    {
      name: "Standard Room",
      price: Math.round((base * 0.6) / 500) * 500,
      guests: 2,
      beds: "1 Queen bed",
      features: ["Free Wi-Fi", "Mountain view", "Breakfast included"],
    },
    {
      name: "Deluxe Room",
      price: base,
      guests: 3,
      beds: "1 King bed",
      features: ["Free Wi-Fi", "Private balcony", "Breakfast & dinner"],
    },
    {
      name: "Executive Suite",
      price: Math.round((base * 1.8) / 500) * 500,
      guests: 4,
      beds: "2 Beds + lounge",
      features: ["Free Wi-Fi", "Private terrace", "All meals", "Best views"],
    },
  ];
}

function nightsBetween(a: string, b: string) {
  if (!a || !b) return 0;
  const diff = (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
  return diff > 0 ? Math.round(diff) : 0;
}

type RoomItem = {
  id?: string;
  name: string;
  price: number;
  guests: number;
  beds: string;
  features: string[];
  total_units?: number;
  /** The room's own uploaded photos (rooms.images). */
  images?: string[] | null;
  /* Optional owner-typed details (phase139). */
  room_size?: string | null;
  view_type?: string | null;
  classification?: string | null;
  wifi_climate?: string | null;
};

export function HotelProfile({
  listing,
  dbRooms,
  dbAmenities,
  dbDescription,
  dbGallery,
  ownerEmail,
  paymentConfig,
  rankingBadge,
}: {
  listing: Listing;
  dbRooms?: RoomItem[];
  dbAmenities?: string[] | null;
  dbDescription?: string | null;
  dbGallery?: string[] | null;
  ownerEmail?: string | null;
  paymentConfig?: PaymentConfig;
  rankingBadge?: string | null;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { isWished, toggle } = useWishlist();
  const wished = isWished(listing.id);
  /* The cover plus whatever the owner actually uploaded — no stock padding.
     See realGallery() for why a short gallery is better than a padded one. */
  const gallery = React.useMemo(
    () => realGallery(listing.image, dbGallery),
    [listing.image, dbGallery]
  );
  // Database hotel (dbRooms is defined, possibly empty) → show only the owner's
  // real rooms; if none yet, a single room at the hotel's own price. Static
  // sample listings keep the generated demo rooms.
  const rooms: RoomItem[] = dbRooms
    ? dbRooms.length > 0
      ? dbRooms
      : [
          {
            name: "Standard Room",
            price: listing.price,
            guests: 2,
            beds: "1 Bed",
            features: [],
          },
        ]
    : buildRooms(listing);
  /* ------------------------------------------------------------------
     ONLY THE AMENITIES THE OWNER TICKED

     This used to fall back to a hard-coded list — free Wi-Fi, breakfast
     included, on-site restaurant, airport pickup — for any hotel that had
     entered none. Those are not decoration: a traveller books on them, and
     the feature cards above are DERIVED from this list, so an empty hotel
     was advertising parking, Wi-Fi and a restaurant it may not have.

     Empty now means empty. The section below hides itself. */
  const amenityList = dbAmenities ?? [];

  // Feature cards — derived from real data; empties are hidden by FeatureCards.
  const hasAmenity = (re: RegExp) => amenityList.some((a) => re.test(a));
  const maxGuests = Math.max(0, ...rooms.map((r) => r.guests || 0));
  const hotelFeatures: FeatureItem[] = [
    { icon: BedDouble, label: "Room Types", value: rooms.length || undefined },
    { icon: Users, label: "Sleeps up to", value: maxGuests ? `${maxGuests} guests` : undefined },
    { icon: Car, label: "Parking", value: hasAmenity(/parking/i) ? "Available" : undefined },
    { icon: Wifi, label: "Wi-Fi", value: hasAmenity(/wi-?fi|internet/i) ? "Available" : undefined },
    { icon: UtensilsCrossed, label: "Dining", value: hasAmenity(/restaurant|dining|breakfast/i) ? "On-site" : undefined },
    { icon: ShieldCheck, label: "Status", value: "Verified" },
  ];

  const [activeTab, setActiveTab] = React.useState("about");
  // Per-room quantities: { [roomIndex]: count }
  const [qty, setQty] = React.useState<Record<number, number>>({});
  const [checkIn, setCheckIn] = React.useState("");
  const [checkOut, setCheckOut] = React.useState("");
  const [guests, setGuests] = React.useState(2);
  const [booked, setBooked] = React.useState(false);
  const [bookedRef, setBookedRef] = React.useState("");
  const [bookedId, setBookedId] = React.useState("");
  const [booking, setBooking] = React.useState(false);
  const [bookError, setBookError] = React.useState("");
  /** Room summary captured at step 1, used in the alert sent at step 2. */
  const [pendingSummary, setPendingSummary] = React.useState("");

  // Reviews
  const isDbHotel = isUuid(listing.id);
  const [reviews, setReviews] = React.useState<ReviewRow[]>([]);
  const [myRating, setMyRating] = React.useState(5);
  const [myText, setMyText] = React.useState("");
  const [reviewBusy, setReviewBusy] = React.useState(false);
  const [reviewMsg, setReviewMsg] = React.useState("");
  const [canReview, setCanReview] = React.useState(false);

  const loadReviews = React.useCallback(async () => {
    if (isDbHotel) setReviews(await getReviews(listing.id));
  }, [isDbHotel, listing.id]);

  React.useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  React.useEffect(() => {
    if (user && isDbHotel) {
      hasAcceptedBooking(user.email, listing.id).then(setCanReview);
    } else {
      setCanReview(false);
    }
  }, [user, isDbHotel, listing.id]);

  // Prefill dates/guests from the homepage search (?checkin&checkout&guests)
  React.useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const ci = sp.get("checkin");
    const co = sp.get("checkout");
    const g = Number(sp.get("guests"));
    if (ci) setCheckIn(ci);
    if (co) setCheckOut(co);
    if (g) setGuests(g);
  }, []);

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : listing.rating;
  const reviewCount = isDbHotel ? reviews.length : listing.reviews;

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push(`/signin?redirect=${encodeURIComponent(`/listings/${listing.id}#book`)}`);
      return;
    }
    setReviewMsg("");
    setReviewBusy(true);
    const { error } = await addReview({
      hotel_id: listing.id,
      customer_email: user.email,
      customer_name: user.name,
      customer_avatar: user.avatar ?? null,
      rating: myRating,
      text: myText.trim() || null,
      owner_email: ownerEmail ?? null,
    });
    setReviewBusy(false);
    if (error) {
      setReviewMsg(error.message);
      return;
    }
    void notifyProviderOfReview({
      ownerEmail,
      providerName: listing.title,
      reviewerName: user.name,
      rating: myRating,
      text: myText.trim() || null,
      url: typeof window !== "undefined" ? `${window.location.origin}/listings/${listing.id}` : null,
    });
    setMyText("");
    setMyRating(5);
    setReviewMsg("Thanks! Your review was posted.");
    await loadReviews();
  };
  const [custName, setCustName] = React.useState("");
  const [custPhone, setCustPhone] = React.useState("");
  const [custCity, setCustCity] = React.useState("");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (user) setCustName((n) => n || user.name);
  }, [user]);

  const sectionRefs = {
    about: React.useRef<HTMLDivElement>(null),
    rooms: React.useRef<HTMLDivElement>(null),
    gallery: React.useRef<HTMLDivElement>(null),
    reviews: React.useRef<HTMLDivElement>(null),
    location: React.useRef<HTMLDivElement>(null),
  } as const;

  const scrollTo = (id: keyof typeof sectionRefs) => {
    setActiveTab(id);
    sectionRefs[id].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const nights = nightsBetween(checkIn, checkOut) || 1;
  const selectedRooms = rooms
    .map((r, i) => ({ ...r, n: qty[i] || 0 }))
    .filter((r) => r.n > 0);
  const roomCount = selectedRooms.reduce((s, r) => s + r.n, 0);
  const total =
    selectedRooms.reduce((s, r) => s + r.price * r.n, 0) * nights;

  const setRoom = (i: number, n: number) =>
    setQty((q) => ({ ...q, [i]: Math.max(0, n) }));

  // Live availability per room for the chosen dates.
  const [avail, setAvail] = React.useState<Record<string, number>>({});
  const roomsKey = rooms
    .map((r) => `${r.id ?? ""}:${r.total_units ?? 0}`)
    .join(",");
  React.useEffect(() => {
    if (!isDbHotel || !checkIn || !checkOut) {
      setAvail({});
      return;
    }
    let active = true;
    (async () => {
      const entries = await Promise.all(
        rooms.map(async (r) => {
          if (!r.id) return null;
          const booked = await getRoomBookedUnits(r.id, checkIn, checkOut);
          return [r.id, Math.max(0, (r.total_units ?? 1) - booked)] as [
            string,
            number,
          ];
        })
      );
      if (active)
        setAvail(
          Object.fromEntries(entries.filter(Boolean) as [string, number][])
        );
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDbHotel, checkIn, checkOut, roomsKey]);

  const availableFor = (r: RoomItem) => {
    if (!r.id) return 99; // sample/static rooms — no inventory cap
    if (!checkIn || !checkOut) return r.total_units ?? 99;
    return avail[r.id] ?? (r.total_units ?? 1);
  };

  const handleBook = async () => {
    if (!user) {
      /* Hold everything they typed, then send them to create an account. It
         replays itself when they come back — see useResumeBooking below.
         qty carries the chosen rooms, so the selection survives too. */
      savePendingBooking("hotel", listing.id, {
        qty, checkIn, checkOut, guests, custName, custPhone, custCity, notes,
      });
      router.push(signupHref(`/listings/${listing.id}#book`));
      return;
    }
    if (selectedRooms.length === 0) {
      setBookError("Please select at least one room.");
      return;
    }
    if (checkIn && checkOut) {
      const over = selectedRooms.find((r) => r.n > availableFor(r));
      if (over) {
        setBookError(
          `Sorry, "${over.name}" is already fully booked for the selected dates. Please select different dates or choose another available room.`
        );
        return;
      }
    }
    setBookError("");
    setBooking(true);
    const roomSummary = selectedRooms
      .map((r) => `${r.n}× ${r.name}`)
      .join(", ");
    const { data, error } = await createBooking({
      hotel_id: isUuid(listing.id) ? listing.id : null,
      hotel_title: listing.title,
      room_name: roomSummary,
      customer_email: user.email,
      customer_name: custName.trim() || user.name,
      customer_phone: custPhone.trim() || null,
      customer_city: custCity.trim() || null,
      notes: notes.trim() || null,
      owner_email: ownerEmail ?? null,
      check_in: checkIn || null,
      check_out: checkOut || null,
      guests,
      rooms: roomCount,
      total_price: total,
    });
    setBooking(false);
    if (error) {
      setBookError(error.message);
      return;
    }
    const ref = data?.id ? bookingRef(data.id) : "";
    if (ref) setBookedRef(ref);
    setBookedId(data?.id ?? "");
    setBooked(true);

    // Record each room line for inventory/availability tracking.
    if (data?.id) {
      await Promise.all(
        selectedRooms.map((r) =>
          addBookingRoom({
            booking_id: data.id,
            room_id: r.id ?? null,
            hotel_id: isUuid(listing.id) ? listing.id : null,
            room_name: r.name,
            units: r.n,
            check_in: checkIn || null,
            check_out: checkOut || null,
          })
        )
      );
    }

    // NOTE: no emails or owner alerts here. The booking row exists but the
    // customer still has to choose how to pay and press Submit. Notifying
    // now would tell the owner about bookings that get abandoned.
    setPendingSummary(`${listing.title}${roomSummary ? ` · ${roomSummary}` : ""}`);
  };

  /* Replays the held form once they are back and signed in. Reading the
     snapshot also deletes it, so a refresh cannot book the same rooms twice. */
  const resuming = useResumeBooking({
    kind: "hotel",
    listingId: listing.id,
    ready: Boolean(user),
    restore: (f) => {
      /* qty round-trips through JSON, which turns its numeric keys into
         strings — they have to be put back as numbers or no room matches. */
      const q = f.qty;
      if (q && typeof q === "object") {
        const out: Record<number, number> = {};
        for (const [k, v] of Object.entries(q as Record<string, unknown>)) {
          const n = Number(k);
          if (Number.isFinite(n) && typeof v === "number") out[n] = v;
        }
        setQty(out);
      }
      setCheckIn(str(f.checkIn));
      setCheckOut(str(f.checkOut));
      setGuests(num(f.guests, 2));
      setCustName(str(f.custName));
      setCustPhone(str(f.custPhone));
      setCustCity(str(f.custCity));
      setNotes(str(f.notes));
    },
    submit: () => void handleBook(),
  });

  /**
   * Runs only when the customer completes the payment step. This is the
   * moment the booking becomes real, so this is where everyone is told.
   */
  const notifyBookingSubmitted = React.useCallback(() => {
    if (!user || !bookedId) return;
    const fullName = custName.trim() || user.name;
    const ref = bookingRef(bookedId);

    /* Confirmed here rather than at creation. The row was written while the
       customer was still choosing how to pay; this is the first point at
       which they have actually committed. */
    void setBookingStatus(bookedId, "accepted");

    void sendBookingNotification({
      booking_id: bookedId,
      customer_email: user.email,
      customer_name: fullName,
      customer_avatar: user.avatar,
      ref,
      summary: pendingSummary || listing.title,
    });

    sendEmail(
      user.email,
      "Your Rego booking is confirmed",
      bookingStatusEmail({ name: fullName, hotel: listing.title, ref, accepted: true })
    );
    if (ownerEmail) {
      sendEmail(
        ownerEmail,
        "New confirmed booking — Rego",
        bookingConfirmedEmailToOwner({
          hotel: listing.title,
          ref,
          customer: fullName,
          customerPhone: custPhone.trim() || null,
          checkIn: checkIn || null,
          checkOut: checkOut || null,
        })
      );
    }
  }, [
    user,
    bookedId,
    custName,
    pendingSummary,
    listing.title,
    checkIn,
    checkOut,
    ownerEmail,
  ]);

  return (
    <div className="bg-background">
      <div className="container-px pt-6">
        <Link
          href="/listings"
          className="inline-flex items-center gap-1 text-sm font-medium text-forest-600 transition-colors hover:text-gold"
        >
          <ChevronLeft className="h-4 w-4" /> Back to listings
        </Link>
      </div>

      {/* Top profile header */}
      <div className="container-px mt-4">
        <ListingDetailHeader
          title={listing.title}
          location={`${listing.location}, Gilgit Baltistan`}
          rating={avgRating}
          reviews={reviewCount}
          verified
          badge={rankingBadge || undefined}
          saved={wished}
          onToggleSave={() => toggle(listing)}
        />
      </div>

      {/* Premium gallery */}
      <div className="container-px mt-4">
        <ProfileGallery images={gallery} title={listing.title} />
      </div>

      {/* Feature cards */}
      <div className="container-px mt-5">
        <FeatureCards items={hotelFeatures} />
      </div>

      {/* Sticky tabs */}
      <div className="sticky top-16 z-30 mt-6 border-y border-border bg-white/95 backdrop-blur">
        <div className="container-px no-scrollbar flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => scrollTo(t.id as keyof typeof sectionRefs)}
              className={cn(
                "shrink-0 border-b-2 px-2.5 py-3 text-[13px] font-semibold transition-colors sm:px-4 sm:text-sm",
                activeTab === t.id
                  ? "border-gold text-forest"
                  : "border-transparent text-forest/60 hover:text-forest"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="container-px mt-8 flex flex-col gap-8 pb-16 lg:grid lg:grid-cols-[1fr_360px] lg:gap-10">
        <div className="min-w-0 order-1 lg:col-start-1 lg:row-start-1">
          {/* About */}
          <section ref={sectionRefs.about} className="scroll-mt-32">
            <h2 className="font-display text-xl font-bold text-forest">
              About {listing.title}
            </h2>
            {/* ------------------------------------------------------------
                NO INVENTED MARKETING COPY

                The fallback here promised "sweeping mountain views" and
                "authentic local hospitality" for a property nobody had
                written a word about, and opened by quoting the rating —
                which on a new listing reads "rated 0.0 by 0 guests".

                A hotel with no description now says so plainly. The owner
                sees the gap on their own page and fills it.
                ------------------------------------------------------------ */}
            <p className="mt-3 leading-relaxed text-muted-foreground">
              {dbDescription?.trim() ? (
                dbDescription
              ) : (
                <span className="italic">
                  {listing.title} hasn&rsquo;t added a description yet. Contact
                  them through the booking form for details about the property.
                </span>
              )}
            </p>
            {amenityList.length > 0 && (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {amenityList.map((a) => (
                <div key={a} className="flex items-center gap-2 text-sm text-forest">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-forest-50 text-forest-600">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  {a}
                </div>
              ))}
            </div>
            )}
          </section>

          {/* Rooms */}
          <section ref={sectionRefs.rooms} className="mt-12 scroll-mt-32">
            <h2 className="font-display text-xl font-bold text-forest">
              Rooms &amp; rates
            </h2>
            <div className="mt-4 space-y-4">
              {rooms.map((r, i) => (
                <div
                  key={r.name}
                  className={cn(
                    "flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-premium sm:flex-row sm:items-center",
                    (qty[i] || 0) > 0 ? "border-gold" : "border-border"
                  )}
                >
                  <RoomPhotos images={r.images} title={r.name} />
                  <div className="flex-1">
                    <h3 className="font-display text-lg font-semibold text-forest">
                      {r.name}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" /> Up to {r.guests} guests
                      </span>
                      <span className="flex items-center gap-1">
                        <BedDouble className="h-4 w-4" /> {r.beds}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {r.features.map((f) => (
                        <span
                          key={f}
                          className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-forest/70"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                    <RoomDetails room={r} />
                  </div>
                  <div className="text-right sm:w-44">
                    <p className="font-display text-xl font-bold text-forest">
                      {formatPrice(r.price)}
                    </p>
                    <p className="text-xs text-muted-foreground">/ night</p>
                    {checkIn && checkOut && r.id ? (
                      availableFor(r) === 0 ? (
                        <p className="mt-1 text-xs font-semibold text-red-600">
                          Fully booked
                        </p>
                      ) : (
                        <p className="mt-1 text-xs font-medium text-forest-600">
                          {availableFor(r)} left
                        </p>
                      )
                    ) : null}
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRoom(i, (qty[i] || 0) - 1);
                          setBooked(false);
                        }}
                        disabled={(qty[i] || 0) === 0}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-border text-forest disabled:opacity-40"
                        aria-label="Remove one"
                      >
                        −
                      </button>
                      <span className="w-6 text-center font-display font-bold text-forest">
                        {qty[i] || 0}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setRoom(i, (qty[i] || 0) + 1);
                          setBooked(false);
                        }}
                        disabled={(qty[i] || 0) >= availableFor(r)}
                        className="grid h-8 w-8 place-items-center rounded-lg bg-forest-600 text-white hover:bg-forest-700 disabled:opacity-40"
                        aria-label="Add one"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Secondary content — appears AFTER the booking box on mobile */}
        <div className="min-w-0 order-3 lg:col-start-1 lg:row-start-2">
          {/* Gallery — the first 5 already appear in the hero collage above,
              so this section holds only what's left. Hidden entirely when
              there's nothing more to show. */}
          {gallery.length > HERO_PHOTO_COUNT && (
            <section ref={sectionRefs.gallery} className="scroll-mt-32">
              <h2 className="font-display text-xl font-bold text-forest">
                More photos
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {gallery.length - HERO_PHOTO_COUNT} more
                </span>
              </h2>
              <GalleryGrid
                images={gallery}
                title={listing.title}
                skip={HERO_PHOTO_COUNT}
                className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"
                itemClassName="h-36 sm:h-44"
              />
            </section>
          )}

          {/* Reviews */}
          <section ref={sectionRefs.reviews} className="mt-12 scroll-mt-32">
            <h2 className="font-display text-xl font-bold text-forest">
              Guest reviews
            </h2>
            <div className="mt-4 grid gap-6 rounded-2xl border border-border bg-card p-6 shadow-premium sm:grid-cols-[auto_1fr] sm:items-center">
              <div className="text-center sm:pr-6">
                <p className="font-display text-5xl font-extrabold text-forest">
                  {avgRating.toFixed(1)}
                </p>
                <div className="mt-1 flex justify-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star
                      key={j}
                      className={
                        j < Math.round(avgRating)
                          ? "h-4 w-4 fill-gold text-gold"
                          : "h-4 w-4 text-border"
                      }
                    />
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
                </p>
              </div>
              {/* ------------------------------------------------------------
                  THE CLEANLINESS / LOCATION / SERVICE / VALUE BARS ARE GONE

                  They were four hard-coded numbers — 4.9, 4.8, 4.9, 4.6 —
                  identical on every hotel in the country, and they rendered
                  beside a genuine "0 reviews" count. Rego collects one
                  overall star rating per review and nothing per category, so
                  there is no honest version of that panel to show; it is
                  removed rather than reworked.

                  Bringing it back means collecting the four sub-scores on the
                  review form first, then averaging real rows.
                  ------------------------------------------------------------ */}
              <div className="space-y-1 sm:border-l sm:border-border sm:pl-6">
                {reviewCount > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Average of {reviewCount} verified guest{" "}
                    {reviewCount === 1 ? "review" : "reviews"}.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No reviews yet. Only guests with a completed booking can
                    review, so the first one will be from someone who stayed.
                  </p>
                )}
              </div>
            </div>

            {/* Write a review */}
            {isDbHotel && (
              <div className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-premium">
                <h3 className="font-display text-base font-bold text-forest">
                  Write a review
                </h3>
                {user && !canReview && (
                  <p className="mt-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                    Only guests with a confirmed booking can review this hotel.
                    Book and complete your stay to share your experience.
                  </p>
                )}
                {user && canReview ? (
                  <form onSubmit={submitReview} className="mt-3 space-y-3">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <button
                          type="button"
                          key={i}
                          onClick={() => setMyRating(i + 1)}
                          aria-label={`${i + 1} star`}
                        >
                          <Star
                            className={cn(
                              "h-7 w-7 transition-colors",
                              i < myRating ? "fill-gold text-gold" : "text-border"
                            )}
                          />
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={myText}
                      onChange={(e) => setMyText(e.target.value)}
                      rows={3}
                      placeholder="Share your experience…"
                      className="auth-input resize-none"
                    />
                    {reviewMsg && (
                      <p className="text-sm font-medium text-forest-600">
                        {reviewMsg}
                      </p>
                    )}
                    <Button
                      type="submit"
                      variant="gold"
                      className="rounded-lg"
                      disabled={reviewBusy}
                    >
                      {reviewBusy ? "Posting…" : "Post review"}
                    </Button>
                  </form>
                ) : !user ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    <button
                      onClick={() => router.push(`/signin?redirect=${encodeURIComponent(`/listings/${listing.id}`)}`)}
                      className="font-semibold text-forest-600 hover:text-gold"
                    >
                      Sign in
                    </button>{" "}
                    to leave a review.
                  </p>
                ) : null}
              </div>
            )}

            {/* Reviews list */}
            {isDbHotel ? (
              reviews.length === 0 ? (
                <p className="mt-5 rounded-xl border border-dashed border-border bg-muted/40 py-8 text-center text-sm text-muted-foreground">
                  No reviews yet — be the first to review this hotel.
                </p>
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {reviews.map((r) => (
                    <ReviewCard
                      key={r.id}
                      review={r}
                      isOwner={
                        !!user &&
                        !!ownerEmail &&
                        user.email.trim().toLowerCase() === ownerEmail.trim().toLowerCase()
                      }
                      onChanged={loadReviews}
                    />
                  ))}
                </div>
              )
            ) : (
              <p className="mt-5 rounded-xl border border-dashed border-border bg-muted/40 py-8 text-center text-sm text-muted-foreground">
                No reviews yet — be the first to review this hotel.
              </p>
            )}
          </section>

          {/* Location */}
          <section ref={sectionRefs.location} className="mt-12 scroll-mt-32">
            <h2 className="font-display text-xl font-bold text-forest">Location</h2>
            <p className="mt-2 flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-4 w-4 text-forest-600" />
              {listing.title}, {listing.location}, Gilgit Baltistan, Pakistan
            </p>
            <div className="mt-4 h-64 overflow-hidden rounded-2xl shadow-premium">
              <iframe
                title="map"
                className="h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(
                  listing.location + ", Gilgit Baltistan"
                )}&output=embed`}
              />
            </div>
          </section>
        </div>

        {/* Booking sidebar */}
        <aside className="order-2 lg:order-none lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <div className="sticky top-32 rounded-2xl border border-border bg-card p-6 shadow-card">
            <p className="font-display text-lg font-bold text-forest">
              {roomCount > 0
                ? `${roomCount} room${roomCount > 1 ? "s" : ""} selected`
                : "Select your rooms"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Add room types with the + buttons in the list above.
            </p>

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block rounded-lg border border-border px-3 py-2">
                  <span className="block text-xs font-semibold text-forest">
                    Check-in
                  </span>
                  <input
                    type="date"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    className="w-full bg-transparent text-sm text-forest focus:outline-none"
                  />
                </label>
                <label className="block rounded-lg border border-border px-3 py-2">
                  <span className="block text-xs font-semibold text-forest">
                    Check-out
                  </span>
                  <input
                    type="date"
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="w-full bg-transparent text-sm text-forest focus:outline-none"
                  />
                </label>
              </div>
              <label className="block rounded-lg border border-border px-3 py-2">
                <span className="block text-xs font-semibold text-forest">
                  Guests
                </span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  inputMode="numeric"
                  value={guests || ""}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setGuests(Number.isNaN(v) ? 0 : Math.min(99, Math.max(0, v)));
                  }}
                  onBlur={() => setGuests((g) => (g < 1 ? 1 : g))}
                  placeholder="Enter number of guests"
                  className="w-full bg-transparent text-sm text-forest focus:outline-none"
                />
              </label>

              <label className="block rounded-lg border border-border px-3 py-2">
                <span className="block text-xs font-semibold text-forest">
                  Your name
                </span>
                <input
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="Full name"
                  className="w-full bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block rounded-lg border border-border px-3 py-2">
                  <span className="block text-xs font-semibold text-forest">
                    Phone
                  </span>
                  <input
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    placeholder="+92 3xx…"
                    className="w-full bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none"
                  />
                </label>
                <label className="block rounded-lg border border-border px-3 py-2">
                  <span className="block text-xs font-semibold text-forest">
                    City / from
                  </span>
                  <input
                    value={custCity}
                    onChange={(e) => setCustCity(e.target.value)}
                    placeholder="Lahore"
                    className="w-full bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none"
                  />
                </label>
              </div>

              <label className="block rounded-lg border border-border px-3 py-2">
                <span className="block text-xs font-semibold text-forest">
                  Special requests (optional)
                </span>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything the hotel should know…"
                  className="w-full resize-none bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none"
                />
              </label>
            </div>

            <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
              {selectedRooms.length === 0 ? (
                <p className="text-muted-foreground">No rooms selected yet.</p>
              ) : (
                selectedRooms.map((r) => (
                  <div
                    key={r.name}
                    className="flex justify-between text-muted-foreground"
                  >
                    <span>
                      {r.n}× {r.name} · {nights} night{nights > 1 ? "s" : ""}
                    </span>
                    <span>{formatPrice(r.price * r.n * nights)}</span>
                  </div>
                ))
              )}
              <div className="flex justify-between font-display text-base font-bold text-forest">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>

            <Button
              variant="gold"
              size="lg"
              className="mt-4 w-full rounded-lg"
              onClick={handleBook}
              disabled={booking || resuming}
            >
              {resuming
                ? "Completing your booking…"
                : booking
                  ? "Sending…"
                  : booked
                    ? "Booking confirmed ✓"
                    : "Book now"}
            </Button>
            {bookError && (
              <p className="mt-2 text-center text-sm text-red-600">{bookError}</p>
            )}

            {booked && bookedId ? (
              <div className="mt-4">
                <PaymentPanel
                  table="bookings"
                  bookingId={bookedId}
                  reference={bookedRef}
                  providerName={listing.title}
                  summary={[checkIn && checkOut ? `${checkIn} → ${checkOut}` : ""].filter(Boolean) as string[]}
                  total={total}
                  config={paymentConfig ?? paymentConfigFrom(listing as unknown as Record<string, unknown>)}
                  onConfirmed={notifyBookingSubmitted}
                />
              </div>
            ) : (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                You won&apos;t be charged yet
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
