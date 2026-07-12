"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MapPin,
  ShieldCheck,
  Check,
  Users,
  BedDouble,
  Bath,
  DoorOpen,
  ChevronLeft,
  CalendarRange,
  Clock,
  ScrollText,
  Car,
  Wifi,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ListingDetailHeader } from "@/components/listings/listing-detail-header";
import { ProfileGallery } from "@/components/listings/profile-gallery";
import { FeatureCards, type FeatureItem } from "@/components/listings/feature-cards";
import { PaymentPanel } from "@/components/payments/payment-panel";
import { paymentConfigFrom } from "@/lib/payments";
import { useAuth } from "@/components/auth/auth-context";
import {
  type HomestayRow,
  type HomestayRoomRow,
  getHomestayRoomBookedUnits,
  addHomestayBookingRoom,
  homestayToListing,
} from "@/lib/homestays";
import { useWishlist } from "@/lib/wishlist";
import {
  createHomestayBooking,
  homestayBookingRef,
  hasAcceptedHomestayBooking,
} from "@/lib/homestay-bookings";
import { ReviewsSection } from "@/components/listings/reviews-section";
import {
  sendEmail,
  bookingRequestEmailToCustomer,
  bookingRequestEmailToOwner,
} from "@/lib/email";
import { sendBookingNotification } from "@/lib/messages";
import { cn, formatPrice, photo } from "@/lib/utils";


function nightsBetween(a: string, b: string) {
  if (!a || !b) return 0;
  const diff = (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
  return diff > 0 ? Math.round(diff) : 0;
}

/** All ISO date strings for the nights in [checkIn, checkOut). */
function nightsList(checkIn: string, checkOut: string): string[] {
  if (!checkIn || !checkOut) return [];
  const out: string[] = [];
  const d = new Date(checkIn);
  const end = new Date(checkOut);
  while (d < end) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function HomestayProfile({
  homestay,
  rooms,
}: {
  homestay: HomestayRow;
  rooms: HomestayRoomRow[];
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { isWished, toggle } = useWishlist();
  const wished = isWished(homestay.id);
  const wishItem = React.useMemo(() => homestayToListing(homestay), [homestay]);
  const [canReview, setCanReview] = React.useState(false);
  React.useEffect(() => {
    if (user) hasAcceptedHomestayBooking(user.email, homestay.id).then(setCanReview);
    else setCanReview(false);
  }, [user, homestay.id]);

  const gallery = React.useMemo(() => {
    const imgs = [homestay.image, ...(homestay.gallery ?? [])].filter(
      Boolean
    ) as string[];
    return (imgs.length > 0 ? imgs : ["https://picsum.photos/seed/homestay/900/600"]).map(
      photo
    );
  }, [homestay]);

  const amenityList = homestay.amenities ?? [];
  const hasAmenity = (re: RegExp) => amenityList.some((a) => re.test(a));
  const homestayFeatures: FeatureItem[] = [
    { icon: BedDouble, label: "Rooms", value: homestay.total_rooms || rooms.length || undefined },
    { icon: Car, label: "Parking", value: hasAmenity(/parking/i) ? "Available" : undefined },
    { icon: Wifi, label: "Wi-Fi", value: hasAmenity(/wi-?fi|internet/i) ? "Available" : undefined },
    {
      icon: CalendarRange,
      label: "Min stay",
      value: homestay.min_stay ? `${homestay.min_stay} night${homestay.min_stay > 1 ? "s" : ""}` : undefined,
    },
    { icon: Clock, label: "Check-in", value: homestay.checkin_time || undefined },
    { icon: ShieldCheck, label: "Status", value: homestay.verified ? "Verified" : undefined },
  ];
  const blocked = new Set([
    ...(homestay.blocked_dates ?? []),
    ...(homestay.maintenance_dates ?? []),
  ]);

  const [qty, setQty] = React.useState<Record<number, number>>({});
  const [checkIn, setCheckIn] = React.useState("");
  const [checkOut, setCheckOut] = React.useState("");
  const [guests, setGuests] = React.useState(2);
  const [custName, setCustName] = React.useState("");
  const [custPhone, setCustPhone] = React.useState("");
  const [custCity, setCustCity] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [booked, setBooked] = React.useState(false);
  const [bookedRef, setBookedRef] = React.useState("");
  const [bookedId, setBookedId] = React.useState("");
  const [booking, setBooking] = React.useState(false);
  const [bookError, setBookError] = React.useState("");

  React.useEffect(() => {
    if (user) setCustName((n) => n || user.name);
  }, [user]);

  React.useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const ci = sp.get("checkin");
    const co = sp.get("checkout");
    const g = Number(sp.get("guests"));
    if (ci) setCheckIn(ci);
    if (co) setCheckOut(co);
    if (g) setGuests(g);
  }, []);

  const nights = nightsBetween(checkIn, checkOut) || 1;
  const setRoom = (i: number, n: number) =>
    setQty((q) => ({ ...q, [i]: Math.max(0, n) }));

  const selectedRooms = rooms
    .map((r, i) => ({ room: r, n: qty[i] || 0 }))
    .filter((x) => x.n > 0);
  const roomCount = selectedRooms.reduce((s, x) => s + x.n, 0);
  const total =
    selectedRooms.reduce((s, x) => s + x.room.price * x.n, 0) * nights;

  // Live availability per room for the chosen dates.
  const [avail, setAvail] = React.useState<Record<string, number>>({});
  const roomsKey = rooms.map((r) => `${r.id}:${r.total_units}`).join(",");
  React.useEffect(() => {
    if (!checkIn || !checkOut) {
      setAvail({});
      return;
    }
    let active = true;
    (async () => {
      const entries = await Promise.all(
        rooms.map(async (r) => {
          const used = await getHomestayRoomBookedUnits(r.id, checkIn, checkOut);
          return [r.id, Math.max(0, (r.total_units ?? 1) - used)] as [
            string,
            number,
          ];
        })
      );
      if (active) setAvail(Object.fromEntries(entries));
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkIn, checkOut, roomsKey]);

  const availableFor = (r: HomestayRoomRow) => {
    if (!checkIn || !checkOut) return r.total_units ?? 1;
    return avail[r.id] ?? (r.total_units ?? 1);
  };

  const blockedNight = React.useMemo(() => {
    return nightsList(checkIn, checkOut).find((d) => blocked.has(d)) ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkIn, checkOut]);

  const handleBook = async () => {
    if (!user) {
      router.push(`/signin?redirect=${encodeURIComponent(`/listings/${homestay.id}#book`)}`);
      return;
    }
    if (selectedRooms.length === 0) {
      setBookError("Please select at least one room.");
      return;
    }
    if (blockedNight) {
      setBookError(
        `Sorry, ${blockedNight} is not available (blocked or under maintenance). Please choose different dates.`
      );
      return;
    }
    if (checkIn && checkOut) {
      if (homestay.min_stay && nights < homestay.min_stay) {
        setBookError(`Minimum stay is ${homestay.min_stay} night(s).`);
        return;
      }
      if (homestay.max_stay && nights > homestay.max_stay) {
        setBookError(`Maximum stay is ${homestay.max_stay} night(s).`);
        return;
      }
      const over = selectedRooms.find((x) => x.n > availableFor(x.room));
      if (over) {
        setBookError(
          `Sorry, this room is not available for the selected dates ("${over.room.name}" is fully booked). Please select different dates or choose another available room.`
        );
        return;
      }
    }
    setBookError("");
    setBooking(true);
    const roomSummary = selectedRooms
      .map((x) => `${x.n}× ${x.room.name}`)
      .join(", ");
    const { data, error } = await createHomestayBooking({
      homestay_id: homestay.id,
      homestay_title: homestay.title,
      room_name: roomSummary,
      customer_email: user.email,
      customer_name: custName.trim() || user.name,
      customer_phone: custPhone.trim() || null,
      customer_city: custCity.trim() || null,
      notes: notes.trim() || null,
      owner_email: homestay.owner_email ?? null,
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
    const ref = data?.id ? homestayBookingRef(data.id) : "";
    if (ref) setBookedRef(ref);
    setBookedId(data?.id ?? "");
    setBooked(true);

    if (data?.id) {
      await Promise.all(
        selectedRooms.map((x) =>
          addHomestayBookingRoom({
            booking_id: data.id,
            room_id: x.room.id,
            homestay_id: homestay.id,
            room_name: x.room.name,
            units: x.n,
            check_in: checkIn || null,
            check_out: checkOut || null,
          })
        )
      );
    }

    const fullName = custName.trim() || user.name;
    if (data?.id) {
      await sendBookingNotification({
        booking_id: data.id,
        customer_email: user.email,
        customer_name: fullName,
        customer_avatar: user.avatar,
        ref,
        summary: homestay.title,
      });
    }
    sendEmail(
      user.email,
      "Your Rego homestay booking request",
      bookingRequestEmailToCustomer({
        name: fullName,
        hotel: homestay.title,
        ref,
        checkIn: checkIn || null,
        checkOut: checkOut || null,
      })
    );
    if (homestay.owner_email) {
      sendEmail(
        homestay.owner_email,
        "New homestay booking request — Rego",
        bookingRequestEmailToOwner({
          hotel: homestay.title,
          ref,
          customer: fullName,
        })
      );
    }
  };


  const mapSrc = homestay.map_link
    ? homestay.map_link
    : `https://maps.google.com/maps?q=${encodeURIComponent(
        homestay.location + ", Gilgit Baltistan"
      )}&output=embed`;

  return (
    <div className="bg-background">
      <div className="container-px pt-6">
        <Link
          href="/categories/homestays"
          className="inline-flex items-center gap-1 text-sm font-medium text-forest-600 transition-colors hover:text-gold"
        >
          <ChevronLeft className="h-4 w-4" /> Back to homestays
        </Link>
      </div>

      {/* Top profile header */}
      <div className="container-px mt-4">
        <ListingDetailHeader
          title={homestay.title}
          location={`${homestay.location}, Gilgit Baltistan`}
          rating={Number(homestay.rating || 0)}
          reviews={homestay.reviews}
          verified={homestay.verified}
          badge={homestay.ranking_badge || undefined}
          saved={wished}
          onToggleSave={() => toggle(wishItem)}
        />
      </div>

      {/* Premium gallery */}
      <div className="container-px mt-4">
        <ProfileGallery images={gallery} title={homestay.title} />
      </div>

      {/* Feature cards */}
      <div className="container-px mt-5">
        <FeatureCards items={homestayFeatures} />
      </div>

      {/* Body */}
      <div className="container-px mt-8 flex flex-col gap-8 pb-16 lg:grid lg:grid-cols-[1fr_360px] lg:gap-10">
        <div className="min-w-0 order-1 lg:col-start-1 lg:row-start-1">
          {/* About */}
          <section>
            <h2 className="font-display text-xl font-bold text-forest">
              About {homestay.title}
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              {homestay.description ??
                `${homestay.title} is a verified Rego homestay in ${homestay.location}, offering authentic local hospitality and a comfortable base to explore Gilgit Baltistan.`}
            </p>

            {/* Check-in/out */}
            {(homestay.checkin_time || homestay.checkout_time) && (
              <div className="mt-5 flex flex-wrap gap-4">
                {homestay.checkin_time && (
                  <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-forest">
                    <Clock className="h-4 w-4 text-forest-600" /> Check-in:{" "}
                    <strong>{homestay.checkin_time}</strong>
                  </span>
                )}
                {homestay.checkout_time && (
                  <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-forest">
                    <Clock className="h-4 w-4 text-forest-600" /> Check-out:{" "}
                    <strong>{homestay.checkout_time}</strong>
                  </span>
                )}
              </div>
            )}

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
          <section className="mt-12">
            <h2 className="font-display text-xl font-bold text-forest">
              Rooms &amp; rates
            </h2>
            <div className="mt-4 space-y-4">
              {rooms.length === 0 && (
                <p className="rounded-2xl border border-dashed border-border bg-muted/40 py-8 text-center text-sm text-muted-foreground">
                  No rooms listed yet.
                </p>
              )}
              {rooms.map((r, i) => {
                const left = availableFor(r);
                return (
                  <div
                    key={r.id}
                    className={cn(
                      "flex flex-col gap-4 rounded-3xl border bg-card p-4 shadow-premium sm:flex-row sm:items-center",
                      (qty[i] || 0) > 0 ? "border-gold" : "border-border"
                    )}
                  >
                    <div className="flex-1">
                      <h3 className="font-display text-lg font-semibold text-forest">
                        {r.name}
                        {r.room_type && (
                          <span className="ml-2 rounded-full bg-forest-50 px-2 py-0.5 text-[10px] font-semibold text-forest-600">
                            {r.room_type}
                          </span>
                        )}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" /> Up to {r.max_guests} guests
                        </span>
                        {r.beds && (
                          <span className="flex items-center gap-1">
                            <BedDouble className="h-4 w-4" /> {r.beds}
                          </span>
                        )}
                        {r.bedrooms != null && (
                          <span className="flex items-center gap-1">
                            <DoorOpen className="h-4 w-4" /> {r.bedrooms} bedroom
                            {r.bedrooms !== 1 ? "s" : ""}
                          </span>
                        )}
                        {r.bathrooms != null && (
                          <span className="flex items-center gap-1">
                            <Bath className="h-4 w-4" /> {r.bathrooms} bath
                            {r.bathrooms !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      {r.amenities && r.amenities.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {r.amenities.map((f) => (
                            <span
                              key={f}
                              className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-forest/70"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right sm:w-44">
                      <p className="font-display text-xl font-bold text-forest">
                        {formatPrice(r.price)}
                      </p>
                      <p className="text-xs text-muted-foreground">/ night</p>
                      {checkIn && checkOut ? (
                        left === 0 ? (
                          <p className="mt-1 text-xs font-semibold text-red-600">
                            Not available for these dates
                          </p>
                        ) : (
                          <p className="mt-1 text-xs font-medium text-forest-600">
                            {left} left
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
                          disabled={(qty[i] || 0) >= left}
                          className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-forest text-white disabled:opacity-40"
                          aria-label="Add one"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Secondary content — appears AFTER the booking box on mobile */}
        <div className="min-w-0 order-3 lg:col-start-1 lg:row-start-2">
          {/* House rules & cancellation */}
          {(homestay.house_rules || homestay.cancellation_policy) && (
            <section className="mt-12 grid gap-4 sm:grid-cols-2">
              {homestay.house_rules && (
                <div className="rounded-3xl border border-border bg-card p-5 shadow-premium">
                  <h3 className="flex items-center gap-2 font-display text-base font-bold text-forest">
                    <ScrollText className="h-4 w-4 text-forest-600" /> House rules
                  </h3>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {homestay.house_rules}
                  </p>
                </div>
              )}
              {homestay.cancellation_policy && (
                <div className="rounded-3xl border border-border bg-card p-5 shadow-premium">
                  <h3 className="flex items-center gap-2 font-display text-base font-bold text-forest">
                    <ShieldCheck className="h-4 w-4 text-forest-600" /> Cancellation
                    policy
                  </h3>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {homestay.cancellation_policy}
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Gallery */}
          <section className="mt-12">
            <h2 className="font-display text-xl font-bold text-forest">Gallery</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {gallery.map((src, i) => (
                <div
                  key={i}
                  className="relative h-36 overflow-hidden rounded-2xl shadow-premium sm:h-44"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Reviews */}
          <ReviewsSection
            itemId={homestay.id}
            canReview={canReview}
            ownerEmail={homestay.owner_email}
            providerName={homestay.title}
          />

          {/* Location */}
          <section className="mt-12">
            <h2 className="font-display text-xl font-bold text-forest">Location</h2>
            <p className="mt-2 flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-4 w-4 text-forest-600" />
              {homestay.address ||
                `${homestay.title}, ${homestay.location}, Gilgit Baltistan, Pakistan`}
            </p>
            <div className="mt-4 h-64 overflow-hidden rounded-3xl shadow-premium">
              <iframe
                title="map"
                className="h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={mapSrc}
              />
            </div>
          </section>
        </div>

        {/* Booking sidebar */}
        <aside className="order-2 lg:order-none lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <div className="sticky top-32 rounded-3xl border border-border/70 bg-card p-6 shadow-premium-lg">
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
                    min={checkIn || undefined}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="w-full bg-transparent text-sm text-forest focus:outline-none"
                  />
                </label>
              </div>
              <label className="block rounded-lg border border-border px-3 py-2">
                <span className="block text-xs font-semibold text-forest">
                  Guests
                </span>
                <select
                  value={guests}
                  onChange={(e) => setGuests(Number(e.target.value))}
                  className="w-full bg-transparent text-sm text-forest focus:outline-none"
                >
                  {Array.from({ length: 12 }).map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1} {i === 0 ? "Guest" : "Guests"}
                    </option>
                  ))}
                </select>
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
                  <span className="block text-xs font-semibold text-forest">Phone</span>
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
                  placeholder="Anything the host should know…"
                  className="w-full resize-none bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none"
                />
              </label>
            </div>

            <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
              {selectedRooms.length === 0 ? (
                <p className="text-muted-foreground">No rooms selected yet.</p>
              ) : (
                selectedRooms.map((x) => (
                  <div
                    key={x.room.id}
                    className="flex justify-between text-muted-foreground"
                  >
                    <span>
                      {x.n}× {x.room.name} · {nights} night{nights > 1 ? "s" : ""}
                    </span>
                    <span>{formatPrice(x.room.price * x.n * nights)}</span>
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
              disabled={booking}
            >
              {booking
                ? "Sending…"
                : booked
                  ? "Request sent ✓"
                  : !user
                    ? "Sign in to book"
                    : "Next → Payment"}
            </Button>
            {bookError && (
              <p className="mt-2 text-center text-sm text-red-600">{bookError}</p>
            )}

            {booked && bookedId ? (
              <div className="mt-4">
                <PaymentPanel
                  table="homestay_bookings"
                  bookingId={bookedId}
                  reference={bookedRef}
                  providerName={homestay.title}
                  summary={[checkIn && checkOut ? `${checkIn} → ${checkOut}` : ""].filter(Boolean) as string[]}
                  total={total}
                  config={paymentConfigFrom(homestay as unknown as Record<string, unknown>)}
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
