"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Star,
  MapPin,
  ShieldCheck,
  Check,
  X,
  ChevronLeft,
  CalendarRange,
  Users,
  Bus,
  Car,
  Phone,
  Clock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PaymentPanel } from "@/components/payments/payment-panel";
import { paymentConfigFrom } from "@/lib/payments";
import { useAuth } from "@/components/auth/auth-context";
import {
  type TransportServiceRow,
  type RentalVehicleRow,
  type TransportProviderRow,
} from "@/lib/transport";
import {
  createTransportBooking,
  transportBookingRef,
  hasAcceptedTransportBooking,
  isRangeAvailable,
  getUnavailableDates,
} from "@/lib/transport-bookings";
import { ReviewsSection } from "@/components/listings/reviews-section";
import { sendBookingNotification } from "@/lib/messages";
import {
  sendEmail,
  bookingRequestEmailToCustomer,
  bookingRequestEmailToOwner,
} from "@/lib/email";
import { cn, formatPrice, photo } from "@/lib/utils";

type Kind = "service" | "rental";

interface RelatedItem {
  id: string;
  title: string;
  image: string;
  price: number;
  listingType: Kind;
}

interface Props {
  kind: Kind;
  service?: TransportServiceRow;
  rental?: RentalVehicleRow;
  provider: TransportProviderRow | null;
  related: RelatedItem[];
}

function daysBetween(a: string, b: string) {
  if (!a || !b) return 0;
  const d = (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
  return d > 0 ? Math.round(d) : 0;
}

export function TransportItemDetail({ kind, service, rental, provider, related }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const isRental = kind === "rental";

  const id = service?.id ?? rental?.id ?? "";
  const title = service?.title ?? rental?.title ?? "";
  const image = photo(service?.image ?? rental?.image ?? "");
  const gallery = (service?.images ?? rental?.images ?? [])?.map(photo) ?? [];
  const vehicleType = service?.vehicle_type ?? rental?.vehicle_type ?? "Vehicle";
  const location =
    service?.location ?? service?.route ?? rental?.location ?? rental?.pickup_location ?? "Gilgit Baltistan";
  const rating = Number(service?.rating ?? rental?.rating ?? 0);
  const reviews = service?.reviews ?? rental?.reviews ?? 0;
  const unitPrice = service?.price_per_day || service?.price_per_trip || rental?.price_per_day || 0;
  const unitLabel = service && !service.price_per_day && service.price_per_trip ? "trip" : "day";
  const ownerEmail = service?.owner_email ?? rental?.owner_email ?? null;
  const providerId = service?.provider_id ?? rental?.provider_id ?? null;
  const providerName = service?.provider_name ?? rental?.provider_name ?? provider?.name ?? null;
  const description = service?.description ?? rental?.description ?? "";

  // Booking state
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [passengers, setPassengers] = React.useState(1);
  const [pickup, setPickup] = React.useState(service?.pickup_location ?? rental?.pickup_location ?? "");
  const [dropoff, setDropoff] = React.useState(service?.dropoff_location ?? rental?.return_location ?? "");
  const [custName, setCustName] = React.useState("");
  const [custPhone, setCustPhone] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [booking, setBooking] = React.useState(false);
  const [booked, setBooked] = React.useState(false);
  const [bookedRef, setBookedRef] = React.useState("");
  const [bookedId, setBookedId] = React.useState("");
  const [bookError, setBookError] = React.useState("");

  const [unavailable, setUnavailable] = React.useState<string[]>([]);
  React.useEffect(() => {
    if (id) getUnavailableDates(id).then(setUnavailable);
  }, [id]);

  React.useEffect(() => {
    if (user) setCustName((n) => n || user.name);
  }, [user]);

  const [canReview, setCanReview] = React.useState(false);
  React.useEffect(() => {
    if (user) hasAcceptedTransportBooking(user.email, id).then(setCanReview);
    else setCanReview(false);
  }, [user, id]);

  const days = daysBetween(startDate, endDate) || 1;
  const total = unitPrice * days;

  const handleBook = async () => {
    if (!user) {
      router.push(`/signin?redirect=${encodeURIComponent(`/listings/${id}#book`)}`);
      return;
    }
    setBookError("");
    if (!startDate) {
      setBookError(isRental ? "Please select a pickup date." : "Please select a date.");
      return;
    }
    setBooking(true);
    const available = await isRangeAvailable(id, startDate, endDate || startDate);
    if (!available) {
      setBooking(false);
      setBookError("Sorry, this vehicle is not available for the selected dates.");
      return;
    }
    const { data, error } = await createTransportBooking({
      provider_id: providerId,
      listing_type: kind,
      item_id: id,
      item_title: title,
      customer_email: user.email,
      customer_name: custName.trim() || user.name,
      customer_phone: custPhone.trim() || null,
      notes: notes.trim() || null,
      owner_email: ownerEmail,
      pickup_location: pickup.trim() || null,
      dropoff_location: dropoff.trim() || null,
      start_date: startDate || null,
      end_date: endDate || null,
      passengers,
      total_price: total,
    });
    setBooking(false);
    if (error) {
      setBookError(error.message);
      return;
    }
    const ref = data?.id ? transportBookingRef(data.id) : "";
    setBookedRef(ref);
    setBookedId(data?.id ?? "");
    setBooked(true);
    setUnavailable((u) => Array.from(new Set([...u, startDate, endDate].filter(Boolean) as string[])));
    const fullName = custName.trim() || user.name;
    if (data?.id) {
      await sendBookingNotification({
        booking_id: data.id,
        customer_email: user.email,
        customer_name: fullName,
        customer_avatar: user.avatar,
        ref,
        summary: title,
      });
    }
    sendEmail(
      user.email,
      "Your Rego booking request",
      bookingRequestEmailToCustomer({
        name: fullName,
        hotel: title,
        ref,
        checkIn: startDate || null,
        checkOut: endDate || null,
      })
    );
    if (ownerEmail) {
      sendEmail(
        ownerEmail,
        "New booking request — Rego",
        bookingRequestEmailToOwner({ hotel: title, ref, customer: fullName })
      );
    }
  };

  const allImages = [image, ...gallery].filter(Boolean);

  return (
    <div className="bg-background">
      <div className="container-px pt-6">
        <Link
          href="/categories/transport"
          className="inline-flex items-center gap-1 text-sm font-medium text-forest-600 transition-colors hover:text-gold"
        >
          <ChevronLeft className="h-4 w-4" /> Back to Transport &amp; Rental
        </Link>
      </div>

      {/* Gallery */}
      <div className="container-px mt-4">
        <div className="grid gap-2 overflow-hidden rounded-3xl sm:grid-cols-4 sm:grid-rows-2">
          <div className="relative h-64 sm:col-span-2 sm:row-span-2 sm:h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={allImages[0] ?? image} alt={title} className="h-full w-full object-cover" />
          </div>
          {allImages.slice(1, 5).map((src, i) => (
            <div key={i} className="relative hidden h-40 sm:block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      </div>

      {/* Title */}
      <div className="container-px mt-6">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold",
            isRental ? "bg-gold/20 text-gold-700" : "bg-forest-50 text-forest-600"
          )}
        >
          {isRental ? <Car className="h-3.5 w-3.5" /> : <Bus className="h-3.5 w-3.5" />}
          {isRental ? "Vehicle Rental" : "Transport Service"}
        </span>
        <h1 className="mt-2 font-display text-3xl font-bold text-forest sm:text-4xl">{title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="flex items-center gap-1 font-semibold text-forest">
            <Star className="h-4 w-4 fill-gold text-gold" />
            {rating.toFixed(1)}
            <span className="font-normal text-muted-foreground">({reviews} reviews)</span>
          </span>
          {provider?.verified && (
            <span className="flex items-center gap-1 rounded-full bg-forest-50 px-2.5 py-0.5 text-xs font-semibold text-forest-600">
              <ShieldCheck className="h-3.5 w-3.5" /> Verified
            </span>
          )}
          <span className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-4 w-4" /> {location}
          </span>
          {providerName && (
            <span className="flex items-center gap-1 text-forest-600">
              {isRental ? <Car className="h-4 w-4" /> : <Bus className="h-4 w-4" />} {providerName}
            </span>
          )}
        </div>
      </div>

      <div className="container-px mt-8 grid gap-10 pb-16 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-8">
          {description && (
            <section>
              <h2 className="font-display text-xl font-bold text-forest">Overview</h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">{description}</p>
            </section>
          )}

          {kind === "service" && service && <ServiceBody s={service} />}
          {kind === "rental" && rental && <RentalBody r={rental} />}

          {/* Pickup / drop-off */}
          <section className="grid gap-4 sm:grid-cols-2">
            <InfoCard
              title={isRental ? "Pickup location" : "Pickup"}
              value={service?.pickup_location ?? rental?.pickup_location ?? "Flexible"}
            />
            <InfoCard
              title={isRental ? "Return location" : "Drop-off"}
              value={service?.dropoff_location ?? rental?.return_location ?? "Flexible"}
            />
          </section>

          {/* Availability calendar */}
          <AvailabilityCalendar unavailable={unavailable} />

          {provider && <ProviderInfo provider={provider} />}

          {related.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-bold text-forest">
                More from {providerName ?? "this provider"}
              </h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((r) => (
                  <Link
                    key={r.id}
                    href={`/listings/${r.id}`}
                    className="group overflow-hidden rounded-2xl border border-border/70 bg-card shadow-premium transition-shadow hover:shadow-premium-lg"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo(r.image)} alt={r.title} className="h-32 w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="p-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold uppercase", r.listingType === "rental" ? "bg-gold/20 text-gold-700" : "bg-forest-50 text-forest-600")}>
                        {r.listingType === "rental" ? "Rental" : "Service"}
                      </span>
                      <p className="mt-1 truncate font-display text-sm font-semibold text-forest">{r.title}</p>
                      <p className="text-xs font-bold text-forest">{formatPrice(r.price)} <span className="font-normal text-muted-foreground">/ day</span></p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <ReviewsSection
            itemId={id}
            canReview={canReview}
            ownerEmail={ownerEmail}
            providerName={providerName || title}
          />
        </div>

        {/* Booking sidebar */}
        <aside>
          <div id="book" className="sticky top-32 scroll-mt-28 rounded-3xl border border-border/70 bg-card p-6 shadow-premium-lg">
            <p className="font-display text-2xl font-bold text-forest">
              {formatPrice(unitPrice)}
              <span className="text-sm font-normal text-muted-foreground"> / {unitLabel}</span>
            </p>

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block rounded-lg border border-border px-3 py-2">
                  <span className="block text-xs font-semibold text-forest">
                    {isRental ? "Pickup date" : "Date"}
                  </span>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-transparent text-sm text-forest focus:outline-none" />
                </label>
                <label className="block rounded-lg border border-border px-3 py-2">
                  <span className="block text-xs font-semibold text-forest">
                    {isRental ? "Return date" : "End date"}
                  </span>
                  <input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-transparent text-sm text-forest focus:outline-none" />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block rounded-lg border border-border px-3 py-2">
                  <span className="block text-xs font-semibold text-forest">Pickup location</span>
                  <input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Pickup" className="w-full bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none" />
                </label>
                <label className="block rounded-lg border border-border px-3 py-2">
                  <span className="block text-xs font-semibold text-forest">
                    {isRental ? "Return location" : "Drop-off"}
                  </span>
                  <input value={dropoff} onChange={(e) => setDropoff(e.target.value)} placeholder="Drop-off" className="w-full bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none" />
                </label>
              </div>

              {!isRental && (
                <label className="block rounded-lg border border-border px-3 py-2">
                  <span className="block text-xs font-semibold text-forest">Passengers</span>
                  <select value={passengers} onChange={(e) => setPassengers(Number(e.target.value))} className="w-full bg-transparent text-sm text-forest focus:outline-none">
                    {Array.from({ length: 30 }).map((_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}</option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block rounded-lg border border-border px-3 py-2">
                <span className="block text-xs font-semibold text-forest">Your name</span>
                <input value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="Full name" className="w-full bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none" />
              </label>
              <label className="block rounded-lg border border-border px-3 py-2">
                <span className="block text-xs font-semibold text-forest">Phone</span>
                <input value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="+92 3xx…" className="w-full bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none" />
              </label>

              {isRental && rental?.required_documents && rental.required_documents.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-forest">Documents needed at pickup:</span>{" "}
                  {rental.required_documents.join(", ")}
                </div>
              )}

              <label className="block rounded-lg border border-border px-3 py-2">
                <span className="block text-xs font-semibold text-forest">Notes</span>
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to note…" className="w-full resize-none bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none" />
              </label>
            </div>

            <div className="mt-4 flex justify-between border-t border-border pt-4 font-display text-base font-bold text-forest">
              <span>Total <span className="text-xs font-normal text-muted-foreground">({days} {days === 1 ? "day" : "days"})</span></span>
              <span>{formatPrice(total)}</span>
            </div>

            <Button variant="gold" size="lg" className="mt-4 w-full rounded-lg" onClick={handleBook} disabled={booking || booked}>
              {booking ? "Checking availability…" : booked ? "Request sent ✓" : !user ? "Sign in to book" : "Next → Payment"}
            </Button>
            {bookError && <p className="mt-2 text-center text-sm font-medium text-red-600">{bookError}</p>}

            {booked && bookedId && (
              <div className="mt-4">
                <PaymentPanel
                  table="transport_bookings"
                  bookingId={bookedId}
                  reference={bookedRef}
                  providerName={providerName || title}
                  summary={[title].filter(Boolean) as string[]}
                  total={total}
                  config={paymentConfigFrom((service ?? rental ?? provider) as unknown as Record<string, unknown>)}
                />
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ---- bodies ---- */

function ServiceBody({ s }: { s: TransportServiceRow }) {
  const specs: [string, string][] = [
    ["Type", s.vehicle_type ?? "—"],
    ["Model", s.vehicle_name ?? "—"],
    ["Year", s.model_year ?? "—"],
    ["Seats", s.seats != null ? String(s.seats) : "—"],
    ["AC", s.ac ? "Yes" : "No"],
    ["Fuel", s.fuel_type ?? "—"],
    ["Luggage", s.luggage ?? "—"],
    ["Driver", s.driver_included ? s.driver_name || "Included" : "Not included"],
  ];
  const included = [
    s.driver_included ? "Driver" : null,
    s.ac ? "Air-conditioning" : null,
    s.fuel_type ? `${s.fuel_type} fuel` : null,
  ].filter(Boolean) as string[];
  const pricing: [string, string][] = [
    ["Per day", s.price_per_day ? formatPrice(s.price_per_day) : "—"],
    ["Per trip", s.price_per_trip != null ? formatPrice(s.price_per_trip) : "—"],
    ["Per km", s.price_per_km != null ? formatPrice(s.price_per_km) : "—"],
    ["Waiting", s.waiting_charges != null ? formatPrice(s.waiting_charges) : "—"],
  ];
  return (
    <>
      <section>
        <h2 className="font-display text-xl font-bold text-forest">Vehicle details</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {specs.map(([k, v]) => <Spec key={k} k={k} v={v} />)}
        </div>
        {s.route && (
          <p className="mt-4 text-sm text-muted-foreground">
            <span className="font-semibold text-forest">Route / service area:</span> {s.route}
          </p>
        )}
      </section>
      <section>
        <h2 className="font-display text-xl font-bold text-forest">Pricing</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {pricing.map(([k, v]) => <Spec key={k} k={k} v={v} />)}
        </div>
      </section>
      {(included.length > 0 || s.rules) && (
        <section className="grid gap-4 sm:grid-cols-2">
          {included.length > 0 && <ListCard title="Included" items={included} good />}
          {s.rules && <ListCard title="Rules & conditions" items={s.rules.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean)} />}
        </section>
      )}
    </>
  );
}

function RentalBody({ r }: { r: RentalVehicleRow }) {
  const specs: [string, string][] = [
    ["Type", r.vehicle_type ?? "—"],
    ["Model", r.vehicle_name ?? "—"],
    ["Year", r.model_year ?? "—"],
    ["Seats", r.seats != null ? String(r.seats) : "—"],
    ["Rental type", r.rental_type ?? "—"],
    ["Insurance", r.insurance_included ? "Included" : "Not included"],
    ["Mileage limit", r.mileage_limit ?? "—"],
    ["Fuel policy", r.fuel_policy ?? "—"],
  ];
  const pricing: [string, string][] = [
    ["Per hour", r.price_per_hour != null ? formatPrice(r.price_per_hour) : "—"],
    ["Per day", formatPrice(r.price_per_day)],
    ["Weekly", r.weekly_price != null ? formatPrice(r.weekly_price) : "—"],
    ["Monthly", r.monthly_price != null ? formatPrice(r.monthly_price) : "—"],
    ["Security deposit", r.security_deposit != null ? formatPrice(r.security_deposit) : "—"],
    ["Extra mileage", r.extra_mileage_charges != null ? formatPrice(r.extra_mileage_charges) : "—"],
  ];
  return (
    <>
      <section>
        <h2 className="font-display text-xl font-bold text-forest">Vehicle details</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {specs.map(([k, v]) => <Spec key={k} k={k} v={v} />)}
        </div>
      </section>
      <section>
        <h2 className="font-display text-xl font-bold text-forest">Pricing</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {pricing.map(([k, v]) => <Spec key={k} k={k} v={v} />)}
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        {r.required_documents && r.required_documents.length > 0 && (
          <ListCard title="Required documents" items={r.required_documents} good />
        )}
        {(r.damage_policy || r.terms) && (
          <ListCard
            title="Terms & policy"
            items={[r.damage_policy, r.terms].filter(Boolean).join("\n").split(/[\n]+/).map((x) => x.trim()).filter(Boolean)}
          />
        )}
      </section>
    </>
  );
}

function ProviderInfo({ provider }: { provider: TransportProviderRow }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-premium">
      <h2 className="font-display text-lg font-bold text-forest">Provider information</h2>
      <div className="mt-3 flex items-center gap-3">
        {provider.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={provider.logo} alt="" className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-forest text-gold"><Bus className="h-6 w-6" /></span>
        )}
        <div>
          <p className="flex items-center gap-1 font-semibold text-forest">
            {provider.name}
            {provider.verified && <ShieldCheck className="h-4 w-4 text-forest-600" />}
          </p>
          {provider.business_type && <p className="text-xs text-muted-foreground">{provider.business_type}</p>}
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {provider.service_areas && provider.service_areas.length > 0 && (
          <p className="text-muted-foreground"><span className="font-semibold text-forest">Service areas:</span> {provider.service_areas.join(", ")}</p>
        )}
        {provider.opening_hours && (
          <p className="inline-flex items-center gap-1 text-muted-foreground"><Clock className="h-3.5 w-3.5" /> {provider.opening_hours}</p>
        )}
        {provider.emergency_contact && (
          <p className="inline-flex items-center gap-1 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {provider.emergency_contact}</p>
        )}
      </div>
    </section>
  );
}

function AvailabilityCalendar({ unavailable }: { unavailable: string[] }) {
  const taken = new Set(unavailable);
  const today = new Date();
  const months = [0, 1].map((offset) => {
    const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const dayKey = (y: number, m: number, day: number) =>
    `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return (
    <section>
      <h2 className="font-display text-xl font-bold text-forest">Availability</h2>
      <p className="mt-1 text-sm text-muted-foreground">Dates in red are already booked or blocked by the provider.</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {months.map(({ year, month }) => {
          const first = new Date(year, month, 1).getDay();
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const label = new Date(year, month, 1).toLocaleString("default", { month: "long", year: "numeric" });
          return (
            <div key={`${year}-${month}`} className="rounded-2xl border border-border bg-card p-4 shadow-premium">
              <p className="text-center font-display text-sm font-bold text-forest">{label}</p>
              <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i}>{d}</span>)}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {Array.from({ length: first }).map((_, i) => <span key={`e${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const key = dayKey(year, month, day);
                  const isPast = new Date(key) < new Date(today.toISOString().slice(0, 10));
                  const blocked = taken.has(key);
                  return (
                    <span
                      key={day}
                      className={cn(
                        "grid h-7 place-items-center rounded-md text-xs",
                        blocked
                          ? "bg-red-100 font-bold text-red-600 line-through"
                          : isPast
                            ? "text-border"
                            : "bg-forest-50/60 font-medium text-forest"
                      )}
                    >
                      {day}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Spec({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</p>
      <p className="font-semibold text-forest">{v}</p>
    </div>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-premium">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 inline-flex items-center gap-1.5 font-semibold text-forest">
        <MapPin className="h-4 w-4 text-forest-600" /> {value}
      </p>
    </div>
  );
}

function ListCard({ title, items, good }: { title: string; items: string[]; good?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-premium">
      <h3 className="font-display text-base font-bold text-forest">{title}</h3>
      <ul className="mt-2 space-y-1.5 text-sm">
        {items.map((i) => (
          <li key={i} className="flex items-start gap-2 text-muted-foreground">
            <span className={cn("mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full", good ? "bg-forest-50 text-forest-600" : "bg-muted text-forest")}>
              {good ? <Check className="h-3 w-3" /> : <Star className="h-3 w-3" />}
            </span>
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}
