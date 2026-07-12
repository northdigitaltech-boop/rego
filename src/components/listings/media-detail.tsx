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
  Plane,
  Clock,
  Check,
  Camera,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-context";
import { type MediaProviderRow, type MediaPortfolioRow } from "@/lib/media";
import { type MediaServiceRow } from "@/lib/media-services";
import {
  createMediaBooking,
  mediaBookingRef,
  hasAcceptedMediaBooking,
  isMediaRangeAvailable,
  getMediaUnavailableDates,
} from "@/lib/media-bookings";
import { type TourCompanyRow, type TourPackageRow } from "@/lib/tour-companies";
import { ReviewsSection } from "@/components/listings/reviews-section";
import { PortfolioShowcase } from "@/components/listings/portfolio-showcase";
import { PaymentPanel } from "@/components/payments/payment-panel";
import { paymentConfigFrom } from "@/lib/payments";
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

export function MediaDetail({
  provider,
  services,
  portfolio,
  company,
  relatedPackages,
}: {
  provider: MediaProviderRow;
  services: MediaServiceRow[];
  portfolio: MediaPortfolioRow[];
  company: TourCompanyRow | null;
  relatedPackages: TourPackageRow[];
}) {
  const router = useRouter();
  const { user } = useAuth();
  const cover = photo(provider.cover_image || provider.logo || "");
  const logo = photo(provider.logo || "");

  const [serviceId, setServiceId] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [people, setPeople] = React.useState(1);
  const [location, setLocation] = React.useState("");
  const [shootType, setShootType] = React.useState("");
  const [droneRequired, setDroneRequired] = React.useState(false);
  const [editingRequired, setEditingRequired] = React.useState(provider.editing_included);
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
    getMediaUnavailableDates(provider.id).then(setUnavailable);
  }, [provider.id]);

  React.useEffect(() => {
    if (user) setCustName((n) => n || user.name);
  }, [user]);

  const [canReview, setCanReview] = React.useState(false);
  React.useEffect(() => {
    if (user) hasAcceptedMediaBooking(user.email, provider.id).then(setCanReview);
    else setCanReview(false);
  }, [user, provider.id]);

  const selectedService = services.find((s) => s.id === serviceId) || null;
  const basePrice = selectedService ? selectedService.price : provider.starting_price;
  const days = daysBetween(startDate, endDate) || 1;
  const total = basePrice * days;

  const scrollToBook = () => {
    document.getElementById("book")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const requestSimilarShoot = (p: MediaPortfolioRow) => {
    setShootType(p.category || p.title || "");
    if (p.location) setLocation(p.location);
    if (p.drone_model) setDroneRequired(true);
    setNotes((n) => n || `I'd like a shoot similar to your project: ${p.title || p.category || ""}.`);
    scrollToBook();
  };

  const handleBook = async () => {
    if (!user) {
      router.push(`/signin?redirect=${encodeURIComponent(`/listings/${provider.id}#book`)}`);
      return;
    }
    setBookError("");
    if (!startDate) {
      setBookError("Please select a date.");
      return;
    }
    setBooking(true);
    const available = await isMediaRangeAvailable(provider.id, startDate, endDate || startDate);
    if (!available) {
      setBooking(false);
      setBookError("Sorry, this provider is not available for the selected dates.");
      return;
    }
    const fullName = custName.trim() || user.name;
    const { data, error } = await createMediaBooking({
      provider_id: provider.id,
      company_id: provider.company_id,
      service_id: selectedService?.id ?? null,
      service_title: selectedService?.title ?? null,
      item_title: provider.name,
      customer_email: user.email,
      customer_name: fullName,
      customer_phone: custPhone.trim() || null,
      notes: notes.trim() || null,
      owner_email: provider.owner_email,
      location: location.trim() || null,
      start_date: startDate || null,
      end_date: endDate || null,
      duration: selectedService?.duration ?? null,
      people,
      shoot_type: shootType.trim() || selectedService?.title || null,
      drone_required: droneRequired,
      editing_required: editingRequired,
      total_price: total,
    });
    setBooking(false);
    if (error) {
      setBookError(error.message);
      return;
    }
    const ref = data?.id ? mediaBookingRef(data.id) : "";
    setBookedRef(ref);
    setBookedId(data?.id ?? "");
    setBooked(true);
    setUnavailable((u) => Array.from(new Set([...u, startDate, endDate].filter(Boolean) as string[])));
    if (data?.id) {
      await sendBookingNotification({
        booking_id: data.id,
        customer_email: user.email,
        customer_name: fullName,
        customer_avatar: user.avatar,
        ref,
        summary: selectedService ? `${provider.name} · ${selectedService.title}` : provider.name,
      });
    }
    sendEmail(
      user.email,
      "Your Rego booking request",
      bookingRequestEmailToCustomer({
        name: fullName,
        hotel: provider.name,
        ref,
        checkIn: startDate || null,
        checkOut: endDate || null,
      })
    );
    if (provider.owner_email) {
      sendEmail(
        provider.owner_email,
        "New booking request — Rego",
        bookingRequestEmailToOwner({ hotel: provider.name, ref, customer: fullName })
      );
    }
  };

  return (
    <div className="bg-background">
      <div className="container-px pt-6">
        <Link href="/categories/photographers" className="inline-flex items-center gap-1 text-sm font-medium text-forest-600 transition-colors hover:text-gold">
          <ChevronLeft className="h-4 w-4" /> Back to Photographers &amp; Videographers
        </Link>
      </div>

      {/* Header with cover */}
      <div className="container-px mt-4">
        <div className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-premium">
          <div className="relative h-40 sm:h-56">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt={provider.name} className="h-full w-full object-cover" />
          </div>
          <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
            <div className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} alt={provider.name} className="h-28 w-28 rounded-3xl border-4 border-card object-cover shadow-premium" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-3xl font-bold text-forest">{provider.name}</h1>
                {provider.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-2.5 py-0.5 text-xs font-semibold text-forest-600">
                    <ShieldCheck className="h-3.5 w-3.5" /> Verified
                  </span>
                )}
                <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-semibold text-gold-700">{provider.service_type || "Photographer"}</span>
                {provider.drone_available && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-2.5 py-0.5 text-xs font-semibold text-forest-600"><Plane className="h-3.5 w-3.5" /> Drone</span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="flex items-center gap-1 font-semibold text-forest">
                  <Star className="h-4 w-4 fill-gold text-gold" /> {Number(provider.rating).toFixed(1)}
                  <span className="font-normal text-muted-foreground">({provider.reviews} reviews)</span>
                </span>
                {provider.experience_years != null && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground"><Award className="h-4 w-4" /> {provider.experience_years} yrs</span>
                )}
                <span className="inline-flex items-center gap-1 text-muted-foreground"><MapPin className="h-4 w-4" /> {provider.location || provider.city || "Gilgit Baltistan"}</span>
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
          {provider.bio && (
            <section>
              <h2 className="font-display text-xl font-bold text-forest">About</h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">{provider.bio}</p>
            </section>
          )}

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Spec k="Service type" v={provider.service_type || "—"} />
            <Spec k="Experience" v={provider.experience_years != null ? `${provider.experience_years} yrs` : "—"} />
            <Spec k="Delivery time" v={provider.delivery_time || "—"} />
            <Spec k="Languages" v={(provider.languages ?? []).join(", ") || "—"} />
          </section>

          {(provider.equipment || provider.camera_models) && (
            <section>
              <h2 className="font-display text-xl font-bold text-forest">Equipment</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {provider.equipment && <InfoCard title="Gear" value={provider.equipment} />}
                {provider.camera_models && <InfoCard title="Cameras" value={provider.camera_models} />}
              </div>
            </section>
          )}

          {services.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-bold text-forest">Services &amp; pricing</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {services.map((s) => (
                  <div key={s.id} className="rounded-2xl border border-border bg-card p-4 shadow-premium">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-base font-semibold text-forest">{s.title}</h3>
                      <p className="font-display font-bold text-forest">{formatPrice(s.price)}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[s.duration, s.edited_photos ? `${s.edited_photos} edited photos` : "", s.videos ? `${s.videos} videos` : "", s.raw_files ? "raw files" : "", s.drone_included ? "drone" : ""].filter(Boolean).join(" · ")}
                    </p>
                    {s.deliverables && <p className="mt-1 text-sm text-muted-foreground">{s.deliverables}</p>}
                    {s.description && <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          <PortfolioShowcase
            portfolio={portfolio}
            experienceYears={provider.experience_years}
            onBookProvider={scrollToBook}
            onRequestSimilar={requestSimilarShoot}
          />

          <AvailabilityCalendar unavailable={unavailable} />

          {company && relatedPackages.length > 0 && (
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
            itemId={provider.id}
            canReview={canReview}
            ownerEmail={provider.owner_email}
            providerName={provider.name}
          />
        </div>

        {/* Booking sidebar */}
        <aside>
          <div id="book" className="sticky top-32 scroll-mt-28 rounded-3xl border border-border/70 bg-card p-6 shadow-premium-lg">
            <p className="font-display text-2xl font-bold text-forest">
              {formatPrice(provider.starting_price)}
              <span className="text-sm font-normal text-muted-foreground"> starting</span>
            </p>

            <div className="mt-4 space-y-3">
              {services.length > 0 && (
                <label className="block rounded-lg border border-border px-3 py-2">
                  <span className="block text-xs font-semibold text-forest">Service / package</span>
                  <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="w-full bg-transparent text-sm text-forest focus:outline-none">
                    <option value="">Custom shoot</option>
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
                  <span className="block text-xs font-semibold text-forest">People</span>
                  <select value={people} onChange={(e) => setPeople(Number(e.target.value))} className="w-full bg-transparent text-sm text-forest focus:outline-none">
                    {Array.from({ length: 30 }).map((_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                  </select>
                </label>
                <label className="block rounded-lg border border-border px-3 py-2">
                  <span className="block text-xs font-semibold text-forest">Shoot type</span>
                  <input value={shootType} onChange={(e) => setShootType(e.target.value)} placeholder="Wedding, travel…" className="w-full bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none" />
                </label>
              </div>
              <label className="block rounded-lg border border-border px-3 py-2">
                <span className="block text-xs font-semibold text-forest">Location</span>
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Shoot location" className="w-full bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none" />
              </label>
              <div className="flex flex-wrap gap-4 rounded-lg border border-border px-3 py-2.5">
                <label className="flex items-center gap-2 text-sm font-medium text-forest">
                  <input type="checkbox" checked={droneRequired} onChange={(e) => setDroneRequired(e.target.checked)} className="h-4 w-4 accent-forest-600" /> Drone required
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-forest">
                  <input type="checkbox" checked={editingRequired} onChange={(e) => setEditingRequired(e.target.checked)} className="h-4 w-4 accent-forest-600" /> Editing required
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
                  table="media_bookings"
                  bookingId={bookedId}
                  reference={bookedRef}
                  providerName={provider.company_name || provider.name}
                  summary={[shootType || selectedService?.title || "Media shoot", location].filter(Boolean) as string[]}
                  total={total}
                  config={paymentConfigFrom(provider as unknown as Record<string, unknown>)}
                />
              </div>
            )}

            {provider.seasonal_availability && (
              <p className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Season: {provider.seasonal_availability}
              </p>
            )}
            {provider.editing_included && (
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-forest-600" /> Editing included
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

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-premium">
      <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground"><Camera className="h-3.5 w-3.5" /> {title}</p>
      <p className="mt-1 whitespace-pre-line text-sm text-forest">{value}</p>
    </div>
  );
}
