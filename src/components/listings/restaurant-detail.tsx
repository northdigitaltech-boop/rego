"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MapPin,
  ShieldCheck,
  ChevronLeft,
  CalendarRange,
  Clock,
  UtensilsCrossed,
  Check,
  Building2,
  Flame,
  Leaf,
  Soup,
  Tag,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ListingDetailHeader } from "@/components/listings/listing-detail-header";
import { ProfileGallery, GalleryGrid } from "@/components/listings/profile-gallery";
import { FeatureCards, type FeatureItem } from "@/components/listings/feature-cards";
import { PaymentPanel } from "@/components/payments/payment-panel";
import { paymentConfigFrom } from "@/lib/payments";
import { useAuth } from "@/components/auth/auth-context";
import { type RestaurantRow, type MenuItemRow, MENU_CATEGORIES } from "@/lib/restaurants";
import {
  createRestaurantBooking,
  restaurantBookingRef,
  hasAcceptedRestaurantBooking,
} from "@/lib/restaurant-bookings";
import { ReviewsSection } from "@/components/listings/reviews-section";
import {
  sendEmail,
  bookingRequestEmailToCustomer,
  bookingRequestEmailToOwner,
} from "@/lib/email";
import { sendBookingNotification } from "@/lib/messages";
import { cn, formatPrice, photo } from "@/lib/utils";

export function RestaurantDetail({
  restaurant,
  menu,
}: {
  restaurant: RestaurantRow;
  menu: MenuItemRow[];
}) {
  const router = useRouter();
  const { user } = useAuth();
  const r = restaurant;
  const gallery = (r.gallery ?? []).map(photo);
  const galleryImages = [r.cover_image, ...(r.gallery ?? []), r.logo].filter(Boolean) as string[];
  const restaurantFeatures: FeatureItem[] = [
    {
      icon: Clock,
      label: "Open Hours",
      value:
        r.opening_hours || r.closing_hours
          ? `${r.opening_hours ?? ""}${r.closing_hours ? ` – ${r.closing_hours}` : ""}`
          : undefined,
    },
    { icon: UtensilsCrossed, label: "Cuisine", value: (r.cuisine_types ?? []).slice(0, 3).join(", ") || undefined },
    { icon: Soup, label: "Dining", value: (r.dining_options ?? []).slice(0, 3).join(", ") || undefined },
    { icon: Tag, label: "Price Range", value: r.price_range || undefined },
    { icon: MapPin, label: "Location", value: r.location || r.city || undefined },
    { icon: ShieldCheck, label: "Status", value: r.verified ? "Verified" : undefined },
  ];

  // Booking state
  const [custName, setCustName] = React.useState("");
  const [custPhone, setCustPhone] = React.useState("");
  const [date, setDate] = React.useState("");
  const [time, setTime] = React.useState("");
  const [guests, setGuests] = React.useState(2);
  const [notes, setNotes] = React.useState("");
  const [booking, setBooking] = React.useState(false);
  const [booked, setBooked] = React.useState(false);
  const [bookedRef, setBookedRef] = React.useState("");
  const [bookedId, setBookedId] = React.useState("");
  const [bookError, setBookError] = React.useState("");
  const [inquiryMsg, setInquiryMsg] = React.useState("");

  React.useEffect(() => { if (user) setCustName((n) => n || user.name); }, [user]);

  const [canReview, setCanReview] = React.useState(false);
  React.useEffect(() => {
    if (user) hasAcceptedRestaurantBooking(user.email, r.id).then(setCanReview);
    else setCanReview(false);
  }, [user, r.id]);

  // Menu category tabs (All + categories that have items)
  const [activeCat, setActiveCat] = React.useState("All");
  const presentCats = MENU_CATEGORIES.filter((c) => menu.some((m) => m.category === c));
  const cats = ["All", ...presentCats];
  const shownMenu = activeCat === "All" ? menu : menu.filter((m) => m.category === activeCat);

  const requireAuth = () => {
    if (!user) {
      router.push(`/signin?redirect=${encodeURIComponent(`/listings/${r.id}#book`)}`);
      return false;
    }
    return true;
  };

  const handleBook = async () => {
    if (!requireAuth() || !user) return;
    setBookError("");
    if (!date) { setBookError("Please select a date."); return; }
    setBooking(true);
    const fullName = custName.trim() || user.name;
    const { data, error } = await createRestaurantBooking({
      restaurant_id: r.id,
      property_id: r.property_id,
      booking_type: "table",
      item_title: r.name,
      customer_email: user.email,
      customer_name: fullName,
      customer_phone: custPhone.trim() || null,
      notes: notes.trim() || null,
      owner_email: r.owner_email,
      date: date || null,
      time: time || null,
      guests,
    });
    setBooking(false);
    if (error) { setBookError(error.message); return; }
    const ref = data?.id ? restaurantBookingRef(data.id) : "";
    setBookedRef(ref); setBookedId(data?.id ?? ""); setBooked(true);
    if (data?.id) {
      await sendBookingNotification({
        booking_id: data.id,
        customer_email: user.email,
        customer_name: fullName,
        customer_avatar: user.avatar,
        ref,
        summary: `Table for ${guests} at ${r.name}`,
      });
    }
    sendEmail(user.email, "Your Rego table booking request", bookingRequestEmailToCustomer({ name: fullName, hotel: r.name, ref, checkIn: date || null, checkOut: null }));
    if (r.owner_email) sendEmail(r.owner_email, "New table booking — Rego", bookingRequestEmailToOwner({ hotel: r.name, ref, customer: fullName }));
  };

  const handleInquiry = async (item: MenuItemRow) => {
    if (!requireAuth() || !user) return;
    const fullName = custName.trim() || user.name;
    const { data } = await createRestaurantBooking({
      restaurant_id: r.id,
      property_id: r.property_id,
      booking_type: "inquiry",
      item_title: r.name,
      customer_email: user.email,
      customer_name: fullName,
      customer_phone: custPhone.trim() || null,
      notes: `Inquiry about: ${item.name} (${formatPrice(item.discount_price ?? item.price)})`,
      owner_email: r.owner_email,
      guests: 1,
    });
    if (data?.id) {
      await sendBookingNotification({
        booking_id: data.id,
        customer_email: user.email,
        customer_name: fullName,
        customer_avatar: user.avatar,
        ref: restaurantBookingRef(data.id),
        summary: `Food inquiry · ${item.name}`,
      });
      setInquiryMsg(`Inquiry sent for “${item.name}”. The restaurant will reply in chat.`);
      setTimeout(() => setInquiryMsg(""), 5000);
    }
  };

  return (
    <div className="bg-background">
      <div className="container-px pt-6">
        <Link href="/categories/restaurants" className="inline-flex items-center gap-1 text-sm font-medium text-forest-600 transition-colors hover:text-gold">
          <ChevronLeft className="h-4 w-4" /> Back to Restaurants
        </Link>
      </div>

      {/* Top profile header */}
      <div className="container-px mt-4">
        <ListingDetailHeader
          title={r.name}
          location={`${r.location || r.city || "Gilgit Baltistan"}`}
          rating={Number(r.rating)}
          reviews={r.reviews}
          verified={r.verified}
          badge={r.ranking_badge || undefined}
        />
        {r.property_id && r.property_name && (
          <Link
            href={`/listings/${r.property_id}`}
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-forest-600 hover:text-gold"
          >
            <Building2 className="h-4 w-4" /> Inside {r.property_name}
          </Link>
        )}
      </div>

      {/* Premium gallery */}
      <div className="container-px mt-4">
        <ProfileGallery images={galleryImages} title={r.name} />
      </div>

      {/* Feature cards */}
      <div className="container-px mt-5">
        <FeatureCards items={restaurantFeatures} />
      </div>

      <div className="container-px mt-8 grid gap-10 pb-16 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-8">
          {r.description && (
            <section>
              <h2 className="font-display text-xl font-bold text-forest">About</h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">{r.description}</p>
            </section>
          )}

          {r.facilities && r.facilities.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-bold text-forest">Facilities</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {r.facilities.map((fac) => (<span key={fac} className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-3 py-1.5 text-sm font-medium text-forest-600"><Check className="h-3.5 w-3.5" /> {fac}</span>))}
              </div>
            </section>
          )}

          {/* Menu */}
          <section>
            <h2 className="font-display text-xl font-bold text-forest">Menu</h2>
            {menu.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-border bg-muted/40 py-8 text-center text-sm text-muted-foreground">Menu coming soon.</p>
            ) : (
              <>
                <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
                  {cats.map((c) => (
                    <button key={c} onClick={() => setActiveCat(c)} className={cn("shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all", activeCat === c ? "bg-gradient-forest text-white shadow-soft" : "border border-border bg-card text-forest hover:bg-muted")}>{c}</button>
                  ))}
                </div>
                {inquiryMsg && (<p className="mt-3 rounded-lg border border-forest-200 bg-forest-50 px-4 py-2.5 text-sm font-medium text-forest-600">{inquiryMsg}</p>)}
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {shownMenu.map((m) => (
                    <div key={m.id} className="group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-premium transition-all duration-300 hover:-translate-y-1.5 hover:shadow-premium-lg">
                      <div className="relative h-40 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo(m.image || "")} alt={m.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        {m.category && <span className="absolute left-2 top-2 rounded-full bg-forest-900/70 px-2 py-0.5 text-[10px] font-bold uppercase text-white">{m.category}</span>}
                        <span className={cn("absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", m.availability === "available" ? "bg-forest-600 text-white" : "bg-red-500 text-white")}>{m.availability === "available" ? "Available" : "Sold out"}</span>
                      </div>
                      <div className="flex flex-1 flex-col p-3">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-display text-base font-semibold text-forest">{m.name}</h3>
                          <div className="flex shrink-0 gap-1">
                            {m.vegetarian && <Leaf className="h-4 w-4 text-forest-600" />}
                            {m.spicy_level === "Spicy" && <Flame className="h-4 w-4 text-red-500" />}
                          </div>
                        </div>
                        {m.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{m.description}</p>}
                        <div className="mt-2 flex items-end gap-2">
                          {m.discount_price != null ? (
                            <>
                              <span className="font-display text-lg font-bold text-forest">{formatPrice(m.discount_price)}</span>
                              <span className="pb-0.5 text-xs text-muted-foreground line-through">{formatPrice(m.price)}</span>
                            </>
                          ) : (
                            <span className="font-display text-lg font-bold text-forest">{formatPrice(m.price)}</span>
                          )}
                          {m.serving_size && <span className="ml-auto text-[11px] text-muted-foreground">{m.serving_size}</span>}
                        </div>
                        <button onClick={() => handleInquiry(m)} disabled={m.availability !== "available"} className="mt-3 w-full rounded-xl bg-gradient-forest px-3 py-2 text-center text-xs font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5 disabled:opacity-50">
                          {user ? "Add to inquiry" : "Sign in to inquire"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Gallery */}
          {gallery.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-bold text-forest">Gallery</h2>
              <GalleryGrid images={gallery} title={r.name} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3" itemClassName="h-32" />
            </section>
          )}

          {/* Map */}
          {r.map_link && (
            <section>
              <h2 className="font-display text-xl font-bold text-forest">Location</h2>
              <a href={r.map_link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-forest shadow-premium hover:bg-muted">
                <MapPin className="h-4 w-4 text-forest-600" /> {r.address || "Open in maps"}
              </a>
            </section>
          )}

          <ReviewsSection
            itemId={r.id}
            canReview={canReview}
            ownerEmail={r.owner_email}
            providerName={r.name}
          />
        </div>

        {/* Booking sidebar */}
        <aside>
          <div id="book" className="sticky top-32 scroll-mt-28 rounded-3xl border border-border/70 bg-card p-6 shadow-premium-lg">
            <h2 className="font-display text-lg font-bold text-forest">Book a table</h2>
            <p className="mt-1 text-sm text-muted-foreground">Reserve a table — the restaurant confirms your booking.</p>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block rounded-lg border border-border px-3 py-2">
                  <span className="block text-xs font-semibold text-forest">Date</span>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-transparent text-sm text-forest focus:outline-none" />
                </label>
                <label className="block rounded-lg border border-border px-3 py-2">
                  <span className="block text-xs font-semibold text-forest">Time</span>
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full bg-transparent text-sm text-forest focus:outline-none" />
                </label>
              </div>
              <label className="block rounded-lg border border-border px-3 py-2">
                <span className="block text-xs font-semibold text-forest">Guests</span>
                <select value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="w-full bg-transparent text-sm text-forest focus:outline-none">
                  {Array.from({ length: 20 }).map((_, i) => <option key={i + 1} value={i + 1}>{i + 1} {i + 1 > 1 ? "guests" : "guest"}</option>)}
                </select>
              </label>
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

            <Button variant="gold" size="lg" className="mt-4 w-full rounded-lg" onClick={handleBook} disabled={booking || booked}>
              {booking ? "Sending…" : booked ? "Request sent ✓" : !user ? "Sign in to book" : "Next → Payment"}
            </Button>
            {bookError && <p className="mt-2 text-center text-sm font-medium text-red-600">{bookError}</p>}

            {booked && bookedId && (
              <div className="mt-4">
                <PaymentPanel
                  table="restaurant_bookings"
                  bookingId={bookedId}
                  reference={bookedRef}
                  providerName={r.name}
                  summary={[date && time ? `${date} · ${time}` : "", `${guests} guests`].filter(Boolean) as string[]}
                  total={0}
                  config={paymentConfigFrom(r as unknown as Record<string, unknown>)}
                />
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
