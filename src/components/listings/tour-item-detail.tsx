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
  Clock,
  Briefcase,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PaymentPanel } from "@/components/payments/payment-panel";
import { paymentConfigFrom } from "@/lib/payments";
import { useAuth } from "@/components/auth/auth-context";
import {
  type TourPackageRow,
  type TransportRow,
  type TourGuideRow,
  type TourCompanyRow,
} from "@/lib/tour-companies";
import {
  createTourBooking,
  tourBookingRef,
  hasAcceptedTourBooking,
} from "@/lib/tour-bookings";
import { ReviewsSection } from "@/components/listings/reviews-section";
import { sendBookingNotification } from "@/lib/messages";
import {
  sendEmail,
  bookingRequestEmailToCustomer,
  bookingRequestEmailToOwner,
} from "@/lib/email";
import { cn, formatPrice, photo } from "@/lib/utils";


type Kind = "package" | "transport" | "guide";

interface TourItemDetailProps {
  kind: Kind;
  pkg?: TourPackageRow;
  transport?: TransportRow;
  guide?: TourGuideRow;
  company: TourCompanyRow | null;
}

function daysBetween(a: string, b: string) {
  if (!a || !b) return 0;
  const d = (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
  return d > 0 ? Math.round(d) : 0;
}

export function TourItemDetail({
  kind,
  pkg,
  transport,
  guide,
  company,
}: TourItemDetailProps) {
  const router = useRouter();
  const { user } = useAuth();

  // Normalized common fields
  const id =
    pkg?.id ?? transport?.id ?? guide?.id ?? "";
  const title = pkg?.title ?? transport?.name ?? guide?.name ?? "";
  const image = photo(pkg?.image ?? transport?.image ?? guide?.image ?? "");
  const gallery = (
    pkg?.images ??
    transport?.images ??
    (guide?.image ? [guide.image] : [])
  )?.map(photo) ?? [];
  const categoryLabel =
    kind === "package"
      ? pkg?.package_type
        ? `${pkg.package_type} Tour`
        : "Tour Package"
      : kind === "transport"
        ? transport?.vehicle_type ?? "Transport"
        : guide?.specialization
          ? `${guide.specialization} Guide`
          : "Tour Guide";
  const location =
    pkg?.destination ?? transport?.location ?? guide?.location ?? "Gilgit Baltistan";
  const rating = Number(
    pkg?.rating ?? transport?.rating ?? guide?.rating ?? 0
  );
  const reviews = pkg?.reviews ?? transport?.reviews ?? guide?.reviews ?? 0;
  const unitPrice =
    pkg?.price_per_person ?? transport?.price_per_day ?? guide?.price_per_day ?? 0;
  const unitLabel = kind === "package" ? "person" : "day";
  const ownerEmail =
    pkg?.owner_email ?? transport?.owner_email ?? guide?.owner_email ?? null;
  const companyId =
    pkg?.company_id ?? transport?.company_id ?? guide?.company_id ?? null;

  // Booking state
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [guests, setGuests] = React.useState(kind === "package" ? 2 : 1);
  const [custName, setCustName] = React.useState("");
  const [custPhone, setCustPhone] = React.useState("");
  const [custCity, setCustCity] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [booking, setBooking] = React.useState(false);
  const [booked, setBooked] = React.useState(false);
  const [bookedRef, setBookedRef] = React.useState("");
  const [bookedId, setBookedId] = React.useState("");
  const [bookError, setBookError] = React.useState("");

  React.useEffect(() => {
    if (user) setCustName((n) => n || user.name);
  }, [user]);

  const [canReview, setCanReview] = React.useState(false);
  React.useEffect(() => {
    if (user) hasAcceptedTourBooking(user.email, id).then(setCanReview);
    else setCanReview(false);
  }, [user, id]);

  const days = daysBetween(startDate, endDate) || 1;
  const total =
    kind === "package" ? unitPrice * guests : unitPrice * days;

  const handleBook = async () => {
    if (!user) {
      router.push(`/signin?redirect=${encodeURIComponent(`/listings/${id}#book`)}`);
      return;
    }
    setBookError("");
    setBooking(true);
    const { data, error } = await createTourBooking({
      company_id: companyId,
      item_type: kind,
      item_id: id,
      item_title: title,
      customer_email: user.email,
      customer_name: custName.trim() || user.name,
      customer_phone: custPhone.trim() || null,
      customer_city: custCity.trim() || null,
      notes: notes.trim() || null,
      owner_email: ownerEmail,
      start_date: startDate || null,
      end_date: endDate || null,
      guests,
      total_price: total,
    });
    setBooking(false);
    if (error) {
      setBookError(error.message);
      return;
    }
    const ref = data?.id ? tourBookingRef(data.id) : "";
    setBookedRef(ref);
    setBookedId(data?.id ?? "");
    setBooked(true);
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
          href={`/categories/${kind === "package" ? "tours" : kind === "transport" ? "transport" : "guides"}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-forest-600 transition-colors hover:text-gold"
        >
          <ChevronLeft className="h-4 w-4" /> Back
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
        <span className="rounded-md bg-forest-50 px-2.5 py-1 text-xs font-semibold text-forest-600">
          {categoryLabel}
        </span>
        <h1 className="mt-2 font-display text-3xl font-bold text-forest sm:text-4xl">{title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="flex items-center gap-1 font-semibold text-forest">
            <Star className="h-4 w-4 fill-gold text-gold" />
            {rating.toFixed(1)}
            <span className="font-normal text-muted-foreground">({reviews} reviews)</span>
          </span>
          {company?.verified && (
            <span className="flex items-center gap-1 rounded-full bg-forest-50 px-2.5 py-0.5 text-xs font-semibold text-forest-600">
              <ShieldCheck className="h-3.5 w-3.5" /> Verified
            </span>
          )}
          <span className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-4 w-4" /> {location}
          </span>
          {company && (
            <Link
              href={`/listings/${company.id}`}
              className="flex items-center gap-1 text-forest-600 hover:text-gold"
            >
              <Briefcase className="h-4 w-4" /> {company.name}
            </Link>
          )}
        </div>
      </div>

      <div className="container-px mt-8 grid gap-10 pb-16 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-8">
          {kind === "package" && pkg && <PackageBody pkg={pkg} />}
          {kind === "transport" && transport && <TransportBody t={transport} />}
          {kind === "guide" && guide && <GuideBody g={guide} />}
          <ReviewsSection
            itemId={id}
            canReview={canReview}
            ownerEmail={ownerEmail}
            providerName={title}
          />
        </div>

        {/* Booking sidebar */}
        <aside>
          <div className="sticky top-32 rounded-3xl border border-border/70 bg-card p-6 shadow-premium-lg">
            <p className="font-display text-2xl font-bold text-forest">
              {formatPrice(unitPrice)}
              <span className="text-sm font-normal text-muted-foreground"> / {unitLabel}</span>
            </p>

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block rounded-lg border border-border px-3 py-2">
                  <span className="block text-xs font-semibold text-forest">
                    {kind === "package" ? "Start date" : "From"}
                  </span>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-transparent text-sm text-forest focus:outline-none" />
                </label>
                <label className="block rounded-lg border border-border px-3 py-2">
                  <span className="block text-xs font-semibold text-forest">
                    {kind === "package" ? "End date" : "To"}
                  </span>
                  <input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-transparent text-sm text-forest focus:outline-none" />
                </label>
              </div>
              <label className="block rounded-lg border border-border px-3 py-2">
                <span className="block text-xs font-semibold text-forest">
                  {kind === "package" ? "Persons" : "Guests"}
                </span>
                <select value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="w-full bg-transparent text-sm text-forest focus:outline-none">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
              </label>
              <label className="block rounded-lg border border-border px-3 py-2">
                <span className="block text-xs font-semibold text-forest">Your name</span>
                <input value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="Full name" className="w-full bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block rounded-lg border border-border px-3 py-2">
                  <span className="block text-xs font-semibold text-forest">Phone</span>
                  <input value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="+92 3xx…" className="w-full bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none" />
                </label>
                <label className="block rounded-lg border border-border px-3 py-2">
                  <span className="block text-xs font-semibold text-forest">City</span>
                  <input value={custCity} onChange={(e) => setCustCity(e.target.value)} placeholder="Lahore" className="w-full bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none" />
                </label>
              </div>
              <label className="block rounded-lg border border-border px-3 py-2">
                <span className="block text-xs font-semibold text-forest">Special requests</span>
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to note…" className="w-full resize-none bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none" />
              </label>
            </div>

            <div className="mt-4 flex justify-between border-t border-border pt-4 font-display text-base font-bold text-forest">
              <span>Total</span>
              <span>{formatPrice(total)}</span>
            </div>

            <Button variant="gold" size="lg" className="mt-4 w-full rounded-lg" onClick={handleBook} disabled={booking}>
              {booking ? "Sending…" : booked ? "Request sent ✓" : !user ? "Sign in to book" : "Next → Payment"}
            </Button>
            {bookError && <p className="mt-2 text-center text-sm text-red-600">{bookError}</p>}

            {booked && bookedId && (
              <div className="mt-4">
                <PaymentPanel
                  table="tour_bookings"
                  bookingId={bookedId}
                  reference={bookedRef}
                  providerName={company?.name || title}
                  summary={[title].filter(Boolean) as string[]}
                  total={total}
                  config={paymentConfigFrom(pkg as unknown as Record<string, unknown>)}
                />
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ---- kind-specific bodies ---- */

function PackageBody({ pkg }: { pkg: TourPackageRow }) {
  const chips: { label: string; on: boolean }[] = [
    { label: "Accommodation", on: pkg.accommodation_included },
    { label: "Transport", on: pkg.transport_included },
    { label: "Guide", on: pkg.guide_included },
    { label: "Meals", on: pkg.meals_included },
  ];
  return (
    <>
      <section>
        <h2 className="font-display text-xl font-bold text-forest">Overview</h2>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          {pkg.duration && <Info icon={Clock} text={pkg.duration} />}
          {(pkg.min_persons || pkg.max_persons) && (
            <Info icon={Users} text={`${pkg.min_persons ?? 1}–${pkg.max_persons ?? "∞"} persons`} />
          )}
          {pkg.difficulty_level && <Info icon={Star} text={pkg.difficulty_level} />}
        </div>
        {pkg.itinerary && (
          <p className="mt-4 whitespace-pre-line leading-relaxed text-muted-foreground">{pkg.itinerary}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((c) => (
            <span key={c.label} className={cn("flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium", c.on ? "bg-forest-50 text-forest-600" : "bg-muted text-muted-foreground line-through")}>
              {c.on ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />} {c.label}
            </span>
          ))}
        </div>
      </section>
      {(pkg.included?.length || pkg.excluded?.length) ? (
        <section className="grid gap-4 sm:grid-cols-2">
          {pkg.included && pkg.included.length > 0 && (
            <ListCard title="What's included" items={pkg.included} good />
          )}
          {pkg.excluded && pkg.excluded.length > 0 && (
            <ListCard title="Not included" items={pkg.excluded} />
          )}
        </section>
      ) : null}
    </>
  );
}

function TransportBody({ t }: { t: TransportRow }) {
  const specs: [string, string][] = [
    ["Type", t.vehicle_type ?? "—"],
    ["Model year", t.model_year ?? "—"],
    ["Seats", t.seats != null ? String(t.seats) : "—"],
    ["AC", t.ac ? "Yes" : "No"],
    ["Fuel", t.fuel_type ?? "—"],
    ["Driver", t.driver_included ? t.driver_name || "Included" : "Not included"],
    ["Price / trip", t.price_per_trip != null ? formatPrice(t.price_per_trip) : "—"],
    ["Availability", t.availability_status ?? "—"],
  ];
  return (
    <section>
      <h2 className="font-display text-xl font-bold text-forest">Vehicle details</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {specs.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border bg-card p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</p>
            <p className="font-semibold text-forest">{v}</p>
          </div>
        ))}
      </div>
      {t.areas && t.areas.length > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          <span className="font-semibold text-forest">Available areas:</span> {t.areas.join(", ")}
        </p>
      )}
    </section>
  );
}

function GuideBody({ g }: { g: TourGuideRow }) {
  return (
    <section>
      <h2 className="font-display text-xl font-bold text-forest">About the guide</h2>
      {g.bio && <p className="mt-3 leading-relaxed text-muted-foreground">{g.bio}</p>}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Spec k="Specialization" v={g.specialization ? `${g.specialization} Guide` : "—"} />
        <Spec k="Experience" v={g.experience_years != null ? `${g.experience_years} yrs` : "—"} />
        <Spec k="Languages" v={(g.languages ?? []).join(", ") || "—"} />
      </div>
      {g.areas && g.areas.length > 0 && (
        <p className="mt-4 text-sm text-muted-foreground"><span className="font-semibold text-forest">Areas:</span> {g.areas.join(", ")}</p>
      )}
      {g.certifications && g.certifications.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {g.certifications.map((c) => (
            <span key={c} className="rounded-full bg-forest-50 px-2.5 py-1 text-xs font-medium text-forest-600">{c}</span>
          ))}
        </div>
      )}
    </section>
  );
}

function Info({ icon: Icon, text }: { icon: typeof Clock; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-forest">
      <Icon className="h-4 w-4 text-forest-600" /> {text}
    </span>
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
function ListCard({ title, items, good }: { title: string; items: string[]; good?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-premium">
      <h3 className="font-display text-base font-bold text-forest">{title}</h3>
      <ul className="mt-2 space-y-1.5 text-sm">
        {items.map((i) => (
          <li key={i} className="flex items-start gap-2 text-muted-foreground">
            <span className={cn("mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full", good ? "bg-forest-50 text-forest-600" : "bg-red-50 text-red-500")}>
              {good ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            </span>
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}
