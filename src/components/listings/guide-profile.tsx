"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Star,
  MapPin,
  ShieldCheck,
  ChevronLeft,
  CalendarRange,
  Award,
  Languages,
  Briefcase,
  Clock,
  Check,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PaymentPanel } from "@/components/payments/payment-panel";
import { paymentConfigFrom } from "@/lib/payments";
import { useAuth } from "@/components/auth/auth-context";
import {
  type TourGuideRow,
  type TourCompanyRow,
  type TourPackageRow,
} from "@/lib/tour-companies";
import { type GuideServiceRow } from "@/lib/guide-services";
import {
  createGuideBooking,
  guideBookingRef,
  hasAcceptedGuideBooking,
  isGuideRangeAvailable,
  getGuideUnavailableDates,
} from "@/lib/guide-bookings";
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

function daysBetween(a: string, b: string) {
  if (!a || !b) return 0;
  const d = (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
  return d > 0 ? Math.round(d) : 0;
}

export function GuideProfile({
  guide,
  company,
  services,
  relatedPackages,
}: {
  guide: TourGuideRow;
  company: TourCompanyRow | null;
  services: GuideServiceRow[];
  relatedPackages: TourPackageRow[];
}) {
  const router = useRouter();
  const { user } = useAuth();
  const isCompanyGuide = !!guide.company_id;
  const typeLabel = guide.guide_type || guide.specialization || "Tour Guide";
  const gallery = (guide.gallery ?? []).map(photo);
  const image = photo(guide.image || "");

  // Booking state
  const [serviceId, setServiceId] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [guests, setGuests] = React.useState(1);
  const [pickup, setPickup] = React.useState("");
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
    getGuideUnavailableDates(guide.id).then(setUnavailable);
  }, [guide.id]);

  React.useEffect(() => {
    if (user) setCustName((n) => n || user.name);
  }, [user]);

  const [canReview, setCanReview] = React.useState(false);
  React.useEffect(() => {
    if (!user) { setCanReview(false); return; }
    const check = isCompanyGuide ? hasAcceptedTourBooking : hasAcceptedGuideBooking;
    check(user.email, guide.id).then(setCanReview);
  }, [user, guide.id, isCompanyGuide]);

  const selectedService = services.find((s) => s.id === serviceId) || null;
  const basePrice = selectedService ? selectedService.price : guide.price_per_day;
  const days = daysBetween(startDate, endDate) || 1;
  const total = basePrice * days;

  const handleBook = async () => {
    if (!user) {
      router.push(`/signin?redirect=${encodeURIComponent(`/listings/${guide.id}#book`)}`);
      return;
    }
    setBookError("");
    if (!startDate) {
      setBookError("Please select a date.");
      return;
    }
    setBooking(true);
    if (!isCompanyGuide) {
      const available = await isGuideRangeAvailable(guide.id, startDate, endDate || startDate);
      if (!available) {
        setBooking(false);
        setBookError("Sorry, this guide is not available for the selected dates.");
        return;
      }
    }
    const fullName = custName.trim() || user.name;
    let ref = "";
    let newBookingId = "";
    let dbError: { message: string } | null = null;
    if (isCompanyGuide) {
      const { data, error } = await createTourBooking({
        company_id: guide.company_id,
        item_type: "guide",
        item_id: guide.id,
        item_title: guide.name,
        customer_email: user.email,
        customer_name: fullName,
        customer_phone: custPhone.trim() || null,
        customer_city: null,
        notes: [selectedService ? `Service: ${selectedService.title}` : "", notes.trim()].filter(Boolean).join(" · ") || null,
        owner_email: guide.owner_email,
        start_date: startDate || null,
        end_date: endDate || null,
        guests,
        total_price: total,
      });
      dbError = error;
      if (data?.id) { ref = tourBookingRef(data.id); newBookingId = data.id; }
    } else {
      const { data, error } = await createGuideBooking({
        guide_id: guide.id,
        company_id: null,
        service_id: selectedService?.id ?? null,
        service_title: selectedService?.title ?? null,
        item_title: guide.name,
        customer_email: user.email,
        customer_name: fullName,
        customer_phone: custPhone.trim() || null,
        notes: notes.trim() || null,
        owner_email: guide.owner_email,
        pickup_location: pickup.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        duration: selectedService?.duration ?? null,
        guests,
        total_price: total,
      });
      dbError = error;
      if (data?.id) { ref = guideBookingRef(data.id); newBookingId = data.id; }
    }
    setBooking(false);
    if (dbError) {
      setBookError(dbError.message);
      return;
    }
    setBookedRef(ref);
    setBookedId(newBookingId);
    setBooked(true);
    if (!isCompanyGuide) {
      setUnavailable((u) => Array.from(new Set([...u, startDate, endDate].filter(Boolean) as string[])));
    }
    if (newBookingId) {
      await sendBookingNotification({
        booking_id: newBookingId,
        customer_email: user.email,
        customer_name: fullName,
        customer_avatar: user.avatar,
        ref,
        summary: selectedService ? `${guide.name} · ${selectedService.title}` : guide.name,
      });
    }
    sendEmail(
      user.email,
      "Your Rego booking request",
      bookingRequestEmailToCustomer({
        name: fullName,
        hotel: guide.name,
        ref,
        checkIn: startDate || null,
        checkOut: endDate || null,
      })
    );
    if (guide.owner_email) {
      sendEmail(
        guide.owner_email,
        "New booking request — Rego",
        bookingRequestEmailToOwner({ hotel: guide.name, ref, customer: fullName })
      );
    }
  };

  const allImages = [image, ...gallery].filter(Boolean);

  return (
    <div className="bg-background">
      <div className="container-px pt-6">
        <Link href="/categories/guides" className="inline-flex items-center gap-1 text-sm font-medium text-forest-600 transition-colors hover:text-gold">
          <ChevronLeft className="h-4 w-4" /> Back to Tour Guides
        </Link>
      </div>

      {/* Header */}
      <div className="container-px mt-4">
        <div className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-premium">
          <div className="h-32 bg-gradient-forest sm:h-40" />
          <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-end">
            <div className="-mt-16 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt={guide.name} className="h-28 w-28 rounded-3xl border-4 border-card object-cover shadow-premium" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-3xl font-bold text-forest">{guide.name}</h1>
                {guide.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-2.5 py-0.5 text-xs font-semibold text-forest-600">
                    <ShieldCheck className="h-3.5 w-3.5" /> Verified
                  </span>
                )}
                <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-semibold text-gold-700">{typeLabel}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="flex items-center gap-1 font-semibold text-forest">
                  <Star className="h-4 w-4 fill-gold text-gold" /> {Number(guide.rating).toFixed(1)}
                  <span className="font-normal text-muted-foreground">({guide.reviews} reviews)</span>
                </span>
                {guide.experience_years != null && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground"><Award className="h-4 w-4" /> {guide.experience_years} yrs experience</span>
                )}
                <span className="inline-flex items-center gap-1 text-muted-foreground"><MapPin className="h-4 w-4" /> {guide.location || guide.city || "Gilgit Baltistan"}</span>
                {company && (
                  <Link href={`/listings/${company.id}`} className="inline-flex items-center gap-1 text-forest-600 hover:text-gold">
                    <Briefcase className="h-4 w-4" /> {company.name}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container-px mt-8 grid gap-10 pb-16 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-8">
          {guide.bio && (
            <section>
              <h2 className="font-display text-xl font-bold text-forest">About</h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">{guide.bio}</p>
            </section>
          )}

          {/* Quick facts */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Spec k="Guide type" v={typeLabel} />
            <Spec k="Experience" v={guide.experience_years != null ? `${guide.experience_years} yrs` : "—"} />
            <Spec k="Languages" v={(guide.languages ?? []).join(", ") || "—"} />
            <Spec k="Areas" v={(guide.areas ?? []).join(", ") || "—"} />
          </section>

          {/* Services */}
          {services.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-bold text-forest">Services offered</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {services.map((s) => (
                  <div key={s.id} className="rounded-2xl border border-border bg-card p-4 shadow-premium">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-base font-semibold text-forest">{s.title}</h3>
                      <p className="font-display font-bold text-forest">{formatPrice(s.price)}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{[s.duration, s.area].filter(Boolean).join(" · ")}</p>
                    {s.description && <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Pricing */}
          <section>
            <h2 className="font-display text-xl font-bold text-forest">Pricing</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Spec k="Per day" v={formatPrice(guide.price_per_day)} />
              <Spec k="Per trip" v={guide.price_per_trip != null ? formatPrice(guide.price_per_trip) : "—"} />
              <Spec k="Hourly" v={guide.hourly_price != null ? formatPrice(guide.hourly_price) : "—"} />
              <Spec k="Min / Max" v={`${guide.min_hours ?? "—"}h / ${guide.max_days ?? "—"}d`} />
            </div>
          </section>

          {/* Availability calendar */}
          <AvailabilityCalendar unavailable={unavailable} />

          {/* Gallery */}
          {gallery.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-bold text-forest">Gallery</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {gallery.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} alt="" className="h-32 w-full rounded-2xl object-cover" />
                ))}
              </div>
            </section>
          )}

          {/* Certifications + skills */}
          {((guide.certifications && guide.certifications.length > 0) || (guide.skills && guide.skills.length > 0)) && (
            <section className="grid gap-4 sm:grid-cols-2">
              {guide.certifications && guide.certifications.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-5 shadow-premium">
                  <h3 className="font-display text-base font-bold text-forest">Certifications</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {guide.certifications.map((c) => (
                      <span key={c} className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-2.5 py-1 text-xs font-medium text-forest-600"><Check className="h-3 w-3" /> {c}</span>
                    ))}
                  </div>
                </div>
              )}
              {guide.skills && guide.skills.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-5 shadow-premium">
                  <h3 className="font-display text-base font-bold text-forest">Skills &amp; specialties</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {guide.skills.map((s) => (
                      <span key={s} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-forest">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Related packages */}
          {relatedPackages.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-bold text-forest">Related tour packages</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {relatedPackages.map((p) => (
                  <Link key={p.id} href={`/listings/${p.id}`} className="group overflow-hidden rounded-2xl border border-border/70 bg-card shadow-premium transition-shadow hover:shadow-premium-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo(p.image || "")} alt={p.title} className="h-32 w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="p-3">
                      <p className="truncate font-display text-sm font-semibold text-forest">{p.title}</p>
                      <p className="text-xs font-bold text-forest">{formatPrice(p.price_per_person)} <span className="font-normal text-muted-foreground">/ person</span></p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <ReviewsSection
            itemId={guide.id}
            canReview={canReview}
            ownerEmail={guide.owner_email}
            providerName={guide.name}
          />
        </div>

        {/* Booking sidebar */}
        <aside>
          <div id="book" className="sticky top-32 scroll-mt-28 rounded-3xl border border-border/70 bg-card p-6 shadow-premium-lg">
            <p className="font-display text-2xl font-bold text-forest">
              {formatPrice(guide.price_per_day)}
              <span className="text-sm font-normal text-muted-foreground"> / day</span>
            </p>

            <div className="mt-4 space-y-3">
              {services.length > 0 && (
                <label className="block rounded-lg border border-border px-3 py-2">
                  <span className="block text-xs font-semibold text-forest">Service</span>
                  <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="w-full bg-transparent text-sm text-forest focus:outline-none">
                    <option value="">General guiding</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>{s.title} — {formatPrice(s.price)}</option>
                    ))}
                  </select>
                </label>
              )}
              <div className="grid grid-cols-2 gap-3">
                <label className="block rounded-lg border border-border px-3 py-2">
                  <span className="block text-xs font-semibold text-forest">Date</span>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-transparent text-sm text-forest focus:outline-none" />
                </label>
                <label className="block rounded-lg border border-border px-3 py-2">
                  <span className="block text-xs font-semibold text-forest">End date</span>
                  <input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-transparent text-sm text-forest focus:outline-none" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block rounded-lg border border-border px-3 py-2">
                  <span className="block text-xs font-semibold text-forest">Guests</span>
                  <select value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="w-full bg-transparent text-sm text-forest focus:outline-none">
                    {Array.from({ length: 20 }).map((_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                  </select>
                </label>
                <label className="block rounded-lg border border-border px-3 py-2">
                  <span className="block text-xs font-semibold text-forest">Pickup</span>
                  <input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Location" className="w-full bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none" />
                </label>
              </div>
              <label className="block rounded-lg border border-border px-3 py-2">
                <span className="block text-xs font-semibold text-forest">Your name</span>
                <input value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="Full name" className="w-full bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none" />
              </label>
              <label className="block rounded-lg border border-border px-3 py-2">
                <span className="block text-xs font-semibold text-forest">Phone</span>
                <input value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="+92 3xx…" className="w-full bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none" />
              </label>
              <label className="block rounded-lg border border-border px-3 py-2">
                <span className="block text-xs font-semibold text-forest">Special request</span>
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
                  table={isCompanyGuide ? "tour_bookings" : "guide_bookings"}
                  bookingId={bookedId}
                  reference={bookedRef}
                  providerName={guide.name}
                  summary={[selectedService?.title || "Guide booking"].filter(Boolean) as string[]}
                  total={total}
                  config={paymentConfigFrom(guide as unknown as Record<string, unknown>)}
                />
              </div>
            )}

            {guide.seasonal_availability && (
              <p className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Season: {guide.seasonal_availability}
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
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
      <p className="mt-1 text-sm text-muted-foreground">Dates in red are already booked or blocked.</p>
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
                    <span key={day} className={cn("grid h-7 place-items-center rounded-md text-xs", blocked ? "bg-red-100 font-bold text-red-600 line-through" : isPast ? "text-border" : "bg-forest-50/60 font-medium text-forest")}>
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
