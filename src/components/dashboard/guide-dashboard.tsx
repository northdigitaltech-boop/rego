"use client";

import * as React from "react";
import {
  LayoutDashboard,
  UserRound,
  ListChecks,
  Mountain,
  CalendarCheck,
  CalendarX,
  MessageSquare,
  Star,
  Wallet,
  BarChart3,
  LogOut,
  PlusCircle,
  Trash2,
  Pencil,
  Loader2,
  CheckCircle2,
  XCircle,
  Database,
  TrendingUp,
  Eye,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ImageUpload,
  MultiImageUpload,
  AvatarUpload,
} from "@/components/ui/image-upload";
import { ChatModal } from "@/components/chat/chat-modal";
import { PaymentSettings } from "@/components/payments/payment-settings";
import { PaymentsManager } from "@/components/payments/payments-manager";
import { MessagesInbox } from "@/components/chat/messages-inbox";
import { ContactAdminButton } from "@/components/chat/contact-admin-button";
import { AccountSecurity } from "@/components/account/account-security";
import { OwnerCrm } from "@/components/crm/owner-crm";
import { ActivitiesManager } from "@/components/dashboard/activities-manager";
import { useUnread } from "@/lib/use-unread";
import { type User } from "@/components/auth/auth-context";
import { type BookingRow } from "@/lib/bookings";
import {
  getGuideByOwner,
  createGuide,
  updateGuide,
  type TourGuideRow,
} from "@/lib/tour-companies";
import {
  getServicesByGuide,
  createGuideService,
  updateGuideService,
  deleteGuideService,
  GUIDE_SERVICE_PRESETS,
  type GuideServiceRow,
} from "@/lib/guide-services";
import {
  getGuideBookingsByOwner,
  setGuideBookingStatus,
  guideBookingRef,
  getGuideBlockedDates,
  blockGuideDates,
  unblockGuideDate,
  enumerateDates,
  type GuideBookingRow,
  type GuideAvailabilityRow,
} from "@/lib/guide-bookings";
import { GuideProfile } from "@/components/listings/guide-profile";
import { sendEmail, bookingStatusEmail } from "@/lib/email";
import { sendBookingStatusNotification } from "@/lib/messages";
import { cn, formatPrice } from "@/lib/utils";

const splitList = (s: string) =>
  s.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean);
const joinList = (a: string[] | null | undefined) => (a ?? []).join(", ");
const num = (v: string) => {
  const n = Number(v);
  return v.trim() && !Number.isNaN(n) ? n : null;
};

const GUIDE_TYPES = [
  "Trekking Guide",
  "Mountain Guide",
  "Cultural Guide",
  "City Guide",
  "Adventure Guide",
  "Local Guide",
  "Family Tour Guide",
  "Religious / Heritage Guide",
];

type Tab =
  | "overview"
  | "profile"
  | "services"
  | "activities"
  | "availability"
  | "bookings"
  | "payments"
  | "messages"
  | "reviews"
  | "earnings"
  | "analytics"
  | "crm";

const nav: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: Eye },
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "services", label: "Services", icon: ListChecks },
  { id: "activities", label: "Activities", icon: Mountain },
  { id: "availability", label: "Availability", icon: CalendarX },
  { id: "bookings", label: "Booking Requests", icon: CalendarCheck },
  { id: "payments", label: "Payments", icon: Wallet },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "reviews", label: "Reviews", icon: Star },
  { id: "earnings", label: "Earnings", icon: Wallet },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "crm", label: "CRM & Insights", icon: BarChart3 },
];

export function GuideDashboard({
  user,
  onSignOut,
}: {
  user: User;
  onSignOut: () => void;
}) {
  const [tab, setTab] = React.useState<Tab>("profile");
  const [guide, setGuide] = React.useState<TourGuideRow | null>(null);
  const [services, setServices] = React.useState<GuideServiceRow[]>([]);
  const [bookings, setBookings] = React.useState<GuideBookingRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [chatBooking, setChatBooking] = React.useState<BookingRow | null>(null);

  const refresh = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const g = await getGuideByOwner(user.email);
    setGuide(g);
    if (g) {
      const [s, b] = await Promise.all([
        getServicesByGuide(g.id),
        getGuideBookingsByOwner(user.email),
      ]);
      setServices(s);
      setBookings(b);
    }
    if (!silent) setLoading(false);
  }, [user.email]);

  React.useEffect(() => {
    refresh();
    const t = setInterval(() => { if (document.visibilityState === "visible") refresh(true); }, 45000);
    return () => clearInterval(t);
  }, [refresh]);

  const toRow = (b: GuideBookingRow): BookingRow =>
    ({
      ...b,
      hotel_id: b.guide_id,
      hotel_title: b.item_title,
      room_name: b.service_title,
      check_in: b.start_date,
      check_out: b.end_date,
      rooms: 1,
    }) as unknown as BookingRow;
  const bookingRows = bookings.map(toRow);
  const { unread, markSeen } = useUnread(
    bookings.map((b) => b.id),
    user.email,
    { sound: false }
  );
  const openChatRow = (r: BookingRow) => {
    markSeen(r.id);
    setChatBooking(r);
  };
  const openChat = (b: GuideBookingRow) => openChatRow(toRow(b));

  // Open a specific chat from a navbar notification — instantly if already on
  // this page (event), or on arrival from another page (localStorage).
  React.useEffect(() => {
    const tryOpen = (id: string | null) => {
      if (!id) return;
      const b = bookings.find((x) => x.id === id);
      if (b) {
        try {
          localStorage.removeItem("safarigb_open_chat");
        } catch {
          /* ignore */
        }
        openChat(b);
      }
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
  }, [bookings]);

  const pendingBookings = bookings.filter((b) => b.status === "pending").length;

  const handleBookingAct = async (id: string, status: "accepted" | "rejected") => {
    const b = bookings.find((x) => x.id === id);
    await setGuideBookingStatus(id, status);
    if (b) {
      sendEmail(
        b.customer_email,
        status === "accepted"
          ? "Your Rego booking is confirmed"
          : "Rego booking update",
        bookingStatusEmail({
          name: b.customer_name ?? "Guest",
          hotel: b.item_title,
          ref: guideBookingRef(b.id),
          accepted: status === "accepted",
        })
      );
      await sendBookingStatusNotification({
        booking_id: b.id,
        owner_email: user.email,
        owner_name: guide?.name ?? user.name,
        ref: guideBookingRef(b.id),
        itemTitle: b.item_title,
        status,
      });
    }
    await refresh();
  };

  if (loading) {
    return (
      <div className="container-px py-24 text-center text-muted-foreground">
        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!guide) {
    return (
      <div className="container-px py-10">
        <h1 className="font-display text-3xl font-bold text-forest">
          Welcome, {user.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Create your guide profile to start receiving booking requests.
        </p>
        <div className="mt-8 max-w-3xl">
          <GuideForm user={user} guide={null} onSaved={refresh} />
        </div>
      </div>
    );
  }

  return (
    <div className="container-px py-10">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-3xl font-bold text-forest">{guide.name}</h1>
        <StatusBadge status={guide.status} />
        {guide.verified && (
          <span className="inline-flex items-center gap-1 rounded-full bg-forest-600 px-2.5 py-1 text-xs font-semibold text-white">
            <CheckCircle2 className="h-3.5 w-3.5" /> Verified
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2.5 py-1 text-xs font-semibold text-gold-700">
          Independent Guide
        </span>
        {(guide as { pending_changes?: unknown }).pending_changes != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2.5 py-1 text-xs font-semibold text-gold-700">
            Edits pending admin review
          </span>
        )}
      </div>
      <p className="mt-1 text-muted-foreground">
        Manage your profile, services, availability and bookings — your profile
        goes live once an admin approves it.
      </p>
      <div className="mt-3">
        <ContactAdminButton ownerEmail={user.email} ownerName={user.name} ownerAvatar={user.avatar} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside>
          <div className="sticky top-24 rounded-3xl border border-border/70 bg-card p-3 shadow-premium">
            <div className="flex items-center gap-3 border-b border-border p-3">
              <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-gradient-gold text-forest-900">
                {guide.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={guide.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserRound className="h-6 w-6" />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-forest">{user.name}</p>
                <span className="mt-1 inline-block rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-gold-700">
                  Tour Guide · Partner
                </span>
              </div>
            </div>
            <nav className="mt-2 space-y-1">
              {nav.map((n) => {
                const Icon = n.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => setTab(n.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                      tab === n.id
                        ? "bg-gradient-forest text-white shadow-soft"
                        : "text-forest hover:bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {n.label}
                    {n.id === "bookings" && pendingBookings > 0 && (
                      <span className="ml-auto rounded-full bg-gold px-2 text-[10px] font-bold text-forest-900">
                        {pendingBookings}
                      </span>
                    )}
                    {n.id === "messages" && unread.size > 0 && (
                      <span className="ml-auto rounded-full bg-red-500 px-2 text-[10px] font-bold text-white">
                        {unread.size}
                      </span>
                    )}
                  </button>
                );
              })}
              <button
                onClick={onSignOut}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-forest hover:bg-muted"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </nav>
          </div>
        </aside>

        <div>
          {tab === "overview" && (
            <div>
              <div className="mb-4 rounded-xl border border-forest-200 bg-forest-50/60 px-4 py-3 text-sm text-forest-600">This is exactly how customers see your public page.</div>
              <div className="overflow-hidden rounded-3xl border border-border/70 shadow-premium">
                <GuideProfile guide={guide} company={null} services={services} relatedPackages={[]} />
              </div>
            </div>
          )}
          {tab === "crm" && <OwnerCrm user={user} />}
          {tab === "profile" && (<><GuideForm user={user} guide={guide} onSaved={refresh} /><AccountSecurity /></>)}
          {tab === "services" && (
            <ServicesManager guide={guide} user={user} items={services} onChange={refresh} />
          )}
          {tab === "activities" && (
            <ActivitiesManager user={user} ownerType="guide" businessName={guide?.name ?? user.name} />
          )}
          {tab === "availability" && (
            <AvailabilityEditor guideId={guide.id} ownerEmail={user.email} />
          )}
          {tab === "payments" && (
            <div className="space-y-8">
              <PaymentsManager table="guide_bookings" bookings={bookings} onChange={refresh} senderEmail={user.email} senderName={user.name} />
              <PaymentSettings tables={["tour_guides"]} ownerEmail={user.email} />
            </div>
          )}

          {tab === "bookings" && (
            <BookingsPanel bookings={bookings} onAct={handleBookingAct} onChat={openChat} unread={unread} />
          )}
          {tab === "messages" && (
            <MessagesInbox
              bookings={bookingRows}
              unread={unread}
              otherLabelFor={(b) => b.customer_name ?? b.customer_email}
              onOpen={openChatRow}
            />
          )}
          {tab === "reviews" && <ReviewsPanel guide={guide} />}
          {tab === "earnings" && <EarningsPanel bookings={bookings} />}
          {tab === "analytics" && (
            <AnalyticsPanel guide={guide} services={services} bookings={bookings} />
          )}
        </div>
      </div>

      {chatBooking && (
        <ChatModal
          booking={chatBooking}
          currentEmail={user.email}
          currentName={user.name}
          currentAvatar={user.avatar}
          otherLabel={chatBooking.customer_name ?? chatBooking.customer_email}
          onSeen={() => markSeen(chatBooking.id)}
          onClose={() => setChatBooking(null)}
        />
      )}
    </div>
  );
}

/* ============================================================
 * Guide profile form (registration)
 * ============================================================ */

function GuideForm({
  user,
  guide,
  onSaved,
}: {
  user: User;
  guide: TourGuideRow | null;
  onSaved: () => void;
}) {
  const editing = !!guide;
  const [f, setF] = React.useState({
    name: guide?.name ?? user.name,
    image: guide?.image ?? "",
    cnic: guide?.cnic ?? "",
    phone: guide?.phone ?? "",
    whatsapp: guide?.whatsapp ?? "",
    email: guide?.email ?? user.email,
    address: guide?.address ?? "",
    city: guide?.city ?? "",
    areas: joinList(guide?.areas),
    languages: joinList(guide?.languages),
    experience_years: guide?.experience_years ? String(guide.experience_years) : "",
    guide_type: guide?.guide_type ?? guide?.specialization ?? "Trekking Guide",
    bio: guide?.bio ?? "",
    certifications: joinList(guide?.certifications),
    emergency_contact: guide?.emergency_contact ?? "",
    availability_status: guide?.availability_status ?? "available",
    price_per_day: guide?.price_per_day ? String(guide.price_per_day) : "",
    price_per_trip: guide?.price_per_trip ? String(guide.price_per_trip) : "",
    hourly_price: guide?.hourly_price ? String(guide.hourly_price) : "",
    skills: joinList(guide?.skills),
    gallery: guide?.gallery ?? [],
    social_links: joinList(guide?.social_links),
    cnic_doc: guide?.cnic_doc ?? "",
    license_doc: guide?.license_doc ?? "",
    min_hours: guide?.min_hours ? String(guide.min_hours) : "",
    max_days: guide?.max_days ? String(guide.max_days) : "",
    seasonal_availability: guide?.seasonal_availability ?? "",
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saved, setSaved] = React.useState(false);
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!f.name.trim() || !Number(f.price_per_day)) {
      setError("Please enter your name and a valid price per day.");
      return;
    }
    setSaving(true);
    const payload = {
      company_id: null,
      company_name: null,
      name: f.name.trim(),
      image: f.image.trim() || `https://i.pravatar.cc/300?u=${encodeURIComponent(f.name.trim())}`,
      cnic: f.cnic.trim() || null,
      phone: f.phone.trim() || null,
      whatsapp: f.whatsapp.trim() || null,
      email: f.email.trim() || null,
      address: f.address.trim() || null,
      city: f.city.trim() || null,
      areas: splitList(f.areas),
      location: splitList(f.areas)[0] ?? f.city.trim() ?? null,
      languages: splitList(f.languages),
      experience_years: num(f.experience_years),
      guide_type: f.guide_type,
      specialization: f.guide_type.replace(/ Guide$/, ""),
      bio: f.bio.trim() || null,
      certifications: splitList(f.certifications),
      emergency_contact: f.emergency_contact.trim() || null,
      availability_status: f.availability_status,
      price_per_day: Number(f.price_per_day),
      price_per_trip: num(f.price_per_trip),
      hourly_price: num(f.hourly_price),
      skills: splitList(f.skills),
      gallery: f.gallery,
      social_links: splitList(f.social_links),
      cnic_doc: f.cnic_doc.trim() || null,
      license_doc: f.license_doc.trim() || null,
      min_hours: num(f.min_hours),
      max_days: num(f.max_days),
      seasonal_availability: f.seasonal_availability.trim() || null,
      owner_email: user.email,
    };
    const { error: dbError } = editing
      ? await updateGuide(guide!.id, payload)
      : await createGuide(payload);
    setSaving(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setSaved(true);
    onSaved();
  };

  return (
    <form onSubmit={save} className="space-y-6 rounded-3xl border border-border/70 bg-card p-6 shadow-premium sm:p-8">
      <div>
        <h2 className="font-display text-xl font-bold text-forest">
          {editing ? "Guide profile" : "Create your guide profile"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This profile powers your public page. It goes live once an admin
          approves it.
        </p>
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
      {saved && (
        <div className="flex items-center gap-2 rounded-lg border border-forest-200 bg-forest-50 px-4 py-2.5 text-sm font-medium text-forest-600">
          <CheckCircle2 className="h-4 w-4" /> Saved
        </div>
      )}

      <SectionTitle>About you</SectionTitle>
      <div className="flex items-center gap-4">
        <AvatarUpload value={f.image} onChange={(url) => set({ image: url })} />
        <div className="flex-1">
          <Field label="Full name" required><input value={f.name} onChange={(e) => set({ name: e.target.value })} className="auth-input" /></Field>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Guide type">
          <select value={f.guide_type} onChange={(e) => set({ guide_type: e.target.value })} className="auth-input">
            {GUIDE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Years of experience"><input type="number" value={f.experience_years} onChange={(e) => set({ experience_years: e.target.value })} className="auth-input" /></Field>
        <Field label="Availability">
          <select value={f.availability_status} onChange={(e) => set({ availability_status: e.target.value })} className="auth-input">
            <option value="available">Available</option>
            <option value="busy">Busy</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </Field>
      </div>
      <Field label="Bio / about you"><textarea rows={3} value={f.bio} onChange={(e) => set({ bio: e.target.value })} className="auth-input resize-none" /></Field>

      <SectionTitle>Contact</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Phone"><input value={f.phone} onChange={(e) => set({ phone: e.target.value })} className="auth-input" placeholder="+92 3xx…" /></Field>
        <Field label="WhatsApp"><input value={f.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} className="auth-input" placeholder="+92 3xx…" /></Field>
        <Field label="Email"><input value={f.email} onChange={(e) => set({ email: e.target.value })} className="auth-input" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Address"><input value={f.address} onChange={(e) => set({ address: e.target.value })} className="auth-input" /></Field>
        <Field label="City / district"><input value={f.city} onChange={(e) => set({ city: e.target.value })} className="auth-input" placeholder="Skardu" /></Field>
        <Field label="Emergency contact"><input value={f.emergency_contact} onChange={(e) => set({ emergency_contact: e.target.value })} className="auth-input" /></Field>
      </div>

      <SectionTitle>Coverage &amp; skills</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Areas covered (comma separated)"><input value={f.areas} onChange={(e) => set({ areas: e.target.value })} className="auth-input" placeholder="Skardu, Hunza, Deosai" /></Field>
        <Field label="Languages spoken (comma separated)"><input value={f.languages} onChange={(e) => set({ languages: e.target.value })} className="auth-input" placeholder="English, Urdu, Balti" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Skills / specialties (comma separated)"><input value={f.skills} onChange={(e) => set({ skills: e.target.value })} className="auth-input" placeholder="High-altitude trekking, Photography spots" /></Field>
        <Field label="Certifications / license (comma separated)"><input value={f.certifications} onChange={(e) => set({ certifications: e.target.value })} className="auth-input" placeholder="Licensed Mountain Guide, First Aid" /></Field>
      </div>
      <Field label="Social media links (comma separated)"><input value={f.social_links} onChange={(e) => set({ social_links: e.target.value })} className="auth-input" placeholder="https://instagram.com/…" /></Field>

      <SectionTitle>Pricing &amp; booking limits</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Price / day (PKR)" required><input type="number" value={f.price_per_day} onChange={(e) => set({ price_per_day: e.target.value })} className="auth-input" /></Field>
        <Field label="Price / trip"><input type="number" value={f.price_per_trip} onChange={(e) => set({ price_per_trip: e.target.value })} className="auth-input" /></Field>
        <Field label="Hourly price"><input type="number" value={f.hourly_price} onChange={(e) => set({ hourly_price: e.target.value })} className="auth-input" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Minimum booking hours"><input type="number" value={f.min_hours} onChange={(e) => set({ min_hours: e.target.value })} className="auth-input" /></Field>
        <Field label="Maximum booking days"><input type="number" value={f.max_days} onChange={(e) => set({ max_days: e.target.value })} className="auth-input" /></Field>
        <Field label="Seasonal availability"><input value={f.seasonal_availability} onChange={(e) => set({ seasonal_availability: e.target.value })} className="auth-input" placeholder="Apr – Oct" /></Field>
      </div>

      <SectionTitle>Gallery</SectionTitle>
      <MultiImageUpload value={f.gallery} onChange={(urls) => set({ gallery: urls })} />

      <SectionTitle>Verification documents</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="CNIC / Passport number"><input value={f.cnic} onChange={(e) => set({ cnic: e.target.value })} className="auth-input" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-forest">CNIC / Passport photo</span>
          <ImageUpload value={f.cnic_doc} onChange={(url) => set({ cnic_doc: url })} />
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-forest">Guide license / certificate</span>
          <ImageUpload value={f.license_doc} onChange={(url) => set({ license_doc: url })} />
        </div>
      </div>

      <Button type="submit" variant="gold" size="lg" className="rounded-lg" disabled={saving}>
        {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : editing ? "Save changes" : "Create profile"}
      </Button>
    </form>
  );
}

/* ============================================================
 * Services manager
 * ============================================================ */

function ServicesManager({
  guide,
  user,
  items,
  onChange,
}: {
  guide: TourGuideRow;
  user: User;
  items: GuideServiceRow[];
  onChange: () => void;
}) {
  const [editing, setEditing] = React.useState<GuideServiceRow | null>(null);
  const [adding, setAdding] = React.useState(false);

  if (adding || editing) {
    return (
      <ServiceForm
        guide={guide}
        user={user}
        item={editing}
        onDone={() => { setAdding(false); setEditing(null); onChange(); }}
        onCancel={() => { setAdding(false); setEditing(null); }}
      />
    );
  }
  return (
    <ManagerShell
      title="Manage Services"
      subtitle="The services you offer (full day, trekking, translation, etc.) appear on your public profile."
      onAdd={() => setAdding(true)}
      addLabel="Add service"
      empty={items.length === 0}
      emptyText="No services yet."
    >
      {items.map((s) => (
        <div key={s.id} className="flex flex-col gap-3 rounded-3xl border border-border/70 bg-card p-4 shadow-premium sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-base font-semibold text-forest">{s.title}</h3>
              <p className="font-display font-bold text-forest">{formatPrice(s.price)}</p>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {[s.duration, s.area].filter(Boolean).join(" · ") || "—"}
            </p>
            {s.description && <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(s)} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-forest hover:bg-muted"><Pencil className="h-3.5 w-3.5" /> Edit</button>
            <button onClick={async () => { await deleteGuideService(s.id); onChange(); }} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
          </div>
        </div>
      ))}
    </ManagerShell>
  );
}

function ServiceForm({
  guide,
  user,
  item,
  onDone,
  onCancel,
}: {
  guide: TourGuideRow;
  user: User;
  item: GuideServiceRow | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const editing = !!item;
  const [f, setF] = React.useState({
    title: item?.title ?? GUIDE_SERVICE_PRESETS[0],
    description: item?.description ?? "",
    price: item?.price ? String(item.price) : "",
    duration: item?.duration ?? "Full Day",
    area: item?.area ?? "",
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!f.title.trim() || !Number(f.price)) {
      setError("Please enter a service title and a valid price.");
      return;
    }
    setSaving(true);
    const payload = {
      guide_id: guide.id,
      title: f.title.trim(),
      description: f.description.trim() || null,
      price: Number(f.price),
      duration: f.duration.trim() || null,
      area: f.area.trim() || null,
      owner_email: user.email,
    };
    const { error: dbError } = editing
      ? await updateGuideService(item!.id, payload)
      : await createGuideService(payload);
    setSaving(false);
    if (dbError) { setError(dbError.message); return; }
    onDone();
  };

  return (
    <form onSubmit={save} className="space-y-5 rounded-3xl border border-border/70 bg-card p-6 shadow-premium sm:p-8">
      <FormHeader title={editing ? "Edit service" : "Add service"} onCancel={onCancel} />
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Service title" required>
          <input list="guide-service-presets" value={f.title} onChange={(e) => set({ title: e.target.value })} className="auth-input" />
          <datalist id="guide-service-presets">
            {GUIDE_SERVICE_PRESETS.map((p) => <option key={p} value={p} />)}
          </datalist>
        </Field>
        <Field label="Price (PKR)" required><input type="number" value={f.price} onChange={(e) => set({ price: e.target.value })} className="auth-input" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Duration"><input value={f.duration} onChange={(e) => set({ duration: e.target.value })} className="auth-input" placeholder="Full Day / Half Day / 4 hours" /></Field>
        <Field label="Area covered"><input value={f.area} onChange={(e) => set({ area: e.target.value })} className="auth-input" placeholder="Skardu valley" /></Field>
      </div>
      <Field label="Description"><textarea rows={3} value={f.description} onChange={(e) => set({ description: e.target.value })} className="auth-input resize-none" /></Field>
      <SaveButtons saving={saving} editing={editing} onCancel={onCancel} />
    </form>
  );
}

/* ============================================================
 * Availability editor
 * ============================================================ */

function AvailabilityEditor({ guideId, ownerEmail }: { guideId: string; ownerEmail: string }) {
  const [blocks, setBlocks] = React.useState<GuideAvailabilityRow[]>([]);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [reason, setReason] = React.useState("blocked");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    setBlocks(await getGuideBlockedDates(guideId));
  }, [guideId]);
  React.useEffect(() => { load(); }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!from) { setError("Pick a start date."); return; }
    setBusy(true);
    const dates = enumerateDates(from, to || from);
    const { error: dbError } = await blockGuideDates({ guideId, dates, reason, ownerEmail });
    setBusy(false);
    if (dbError) { setError(dbError.message); return; }
    setFrom(""); setTo("");
    await load();
  };

  return (
    <div className="space-y-5 rounded-3xl border border-border/70 bg-card p-6 shadow-premium sm:p-8">
      <div>
        <h2 className="font-display text-xl font-bold text-forest">Availability calendar</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Block dates you are not available. Customers cannot book a blocked or
          already-booked date.
        </p>
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
      <form onSubmit={add} className="grid gap-4 sm:grid-cols-4">
        <Field label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="auth-input" /></Field>
        <Field label="To (optional)"><input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="auth-input" /></Field>
        <Field label="Reason">
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="auth-input">
            <option value="blocked">Blocked</option>
            <option value="private">Private booking</option>
            <option value="seasonal">Seasonal / off-season</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </Field>
        <div className="flex items-end">
          <Button type="submit" variant="gold" className="rounded-lg" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CalendarX className="h-4 w-4" /> Block</>}
          </Button>
        </div>
      </form>
      {blocks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 py-10 text-center text-sm text-muted-foreground">
          No blocked dates.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {blocks.map((b) => (
            <span key={b.id} className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-sm text-forest">
              {b.date}
              <span className="text-[10px] uppercase text-muted-foreground">{b.reason}</span>
              <button onClick={async () => { await unblockGuideDate(b.id); load(); }} className="text-red-500 hover:text-red-700">
                <XCircle className="h-4 w-4" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * Bookings / Reviews / Earnings / Analytics
 * ============================================================ */

function BookingsPanel({
  bookings,
  onAct,
  onChat,
  unread,
}: {
  bookings: GuideBookingRow[];
  onAct: (id: string, status: "accepted" | "rejected") => void;
  onChat: (b: GuideBookingRow) => void;
  unread: Set<string>;
}) {
  if (bookings.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-muted/40 py-16 text-center">
        <CalendarCheck className="mx-auto h-10 w-10 text-forest-600" />
        <p className="mt-2 font-display text-lg font-semibold text-forest">No booking requests yet</p>
        <p className="text-sm text-muted-foreground">Guide bookings appear here.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {bookings.map((b) => (
        <div key={b.id} className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-xs font-bold tracking-wider text-forest-600">
                {guideBookingRef(b.id)}{b.service_title ? ` · ${b.service_title}` : ""}
              </p>
              <p className="font-display text-base font-semibold text-forest">{b.item_title}</p>
              <p className="text-sm font-semibold text-forest">
                {formatPrice(b.total_price)} · {b.guests} guest{b.guests > 1 ? "s" : ""}
              </p>
            </div>
            {b.status !== "pending" && <BookingStatusBadge status={b.status} />}
          </div>
          <div className="mt-3 grid gap-2 rounded-xl bg-forest-50/50 p-3 text-sm sm:grid-cols-2">
            <KV k="Customer" v={b.customer_name ?? "—"} />
            <KV k="Phone" v={b.customer_phone ?? "—"} />
            <KV k="Pickup" v={b.pickup_location ?? "—"} />
            <KV k="Duration" v={b.duration ?? "—"} />
            <KV k="Start" v={b.start_date ?? "—"} />
            <KV k="End" v={b.end_date ?? "—"} />
          </div>
          {b.notes && (
            <p className="mt-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-forest"><span className="font-semibold">Note:</span> {b.notes}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {b.status === "pending" && (
              <>
                <button onClick={() => onAct(b.id, "accepted")} className="flex items-center gap-1.5 rounded-xl bg-gradient-forest px-3.5 py-2 text-sm font-semibold text-white shadow-soft hover:-translate-y-0.5">
                  <CheckCircle2 className="h-4 w-4" /> Accept
                </button>
                <button onClick={() => onAct(b.id, "rejected")} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                  <XCircle className="h-4 w-4" /> Reject
                </button>
              </>
            )}
            <button
              onClick={() => onChat(b)}
              className={cn(
                "relative flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                unread.has(b.id) ? "border-red-300 bg-red-50 text-red-600" : "border-border text-forest hover:bg-muted"
              )}
            >
              <MessageSquare className="h-4 w-4" /> Message
              {unread.has(b.id) && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500" />}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewsPanel({ guide }: { guide: TourGuideRow }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-premium">
      <div className="flex items-center gap-3">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-forest text-gold">
          <Star className="h-6 w-6 fill-gold" />
        </span>
        <div>
          <p className="font-display text-3xl font-extrabold text-forest">
            {Number(guide.rating || 0).toFixed(1)}
          </p>
          <p className="text-sm text-muted-foreground">
            {guide.reviews} review{guide.reviews === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Only customers with a confirmed booking can leave a review, so every
        rating is from a real trip.
      </p>
    </div>
  );
}

function EarningsPanel({ bookings }: { bookings: GuideBookingRow[] }) {
  const accepted = bookings.filter((b) => b.status === "accepted");
  const total = accepted.reduce((s, b) => s + (b.total_price || 0), 0);
  const month = new Date().toISOString().slice(0, 7);
  const months: { label: string; amount: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toISOString().slice(0, 7);
    months.push({
      label: d.toLocaleString("default", { month: "short" }),
      amount: accepted.filter((b) => b.created_at?.slice(0, 7) === key).reduce((s, b) => s + (b.total_price || 0), 0),
    });
  }
  const max = Math.max(1, ...months.map((m) => m.amount));
  const thisMonth = accepted.filter((b) => b.created_at?.slice(0, 7) === month).reduce((s, b) => s + (b.total_price || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={Wallet} label="Total earnings" value={formatPrice(total)} accent />
        <Stat icon={Wallet} label="This month" value={formatPrice(thisMonth)} />
        <Stat icon={CheckCircle2} label="Completed trips" value={accepted.length} />
      </div>
      <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="h-4 w-4 text-forest-600" /> Monthly earnings
        </p>
        <div className="mt-4 flex items-end gap-3" style={{ height: 140 }}>
          {months.map((m) => (
            <div key={m.label} className="flex flex-1 flex-col items-center justify-end gap-2">
              <span className="text-[10px] font-bold text-forest">{m.amount ? formatPrice(m.amount) : ""}</span>
              <div className="w-full rounded-t-lg bg-gradient-forest" style={{ height: `${(m.amount / max) * 100}%`, minHeight: m.amount ? 6 : 2 }} />
              <span className="text-xs text-muted-foreground">{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AnalyticsPanel({
  guide,
  services,
  bookings,
}: {
  guide: TourGuideRow;
  services: GuideServiceRow[];
  bookings: GuideBookingRow[];
}) {
  const accepted = bookings.filter((b) => b.status === "accepted").length;
  const pending = bookings.filter((b) => b.status === "pending").length;
  const rejected = bookings.filter((b) => b.status === "rejected").length;
  const counts = new Map<string, number>();
  for (const b of bookings) {
    const key = b.service_title || "General guiding";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={CalendarCheck} label="Total bookings" value={bookings.length} accent />
        <Stat icon={Database} label="Pending" value={pending} />
        <Stat icon={CheckCircle2} label="Confirmed" value={accepted} />
        <Stat icon={XCircle} label="Cancelled" value={rejected} />
        <Stat icon={ListChecks} label="Services" value={services.length} />
        <Stat icon={CheckCircle2} label="Completed trips" value={accepted} />
        <Stat icon={Star} label="Rating" value={Number(guide.rating || 0).toFixed(1)} />
        <Stat icon={Star} label="Reviews" value={guide.reviews} />
      </div>
      <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
        <p className="text-sm text-muted-foreground">Most booked services</p>
        {top.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No bookings yet.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {top.map(([name, n]) => (
              <div key={name} className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-forest">{name}</span>
                <span className="text-muted-foreground">{n} booking{n > 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
 * Shared bits
 * ============================================================ */

function ManagerShell({
  title,
  subtitle,
  onAdd,
  addLabel,
  empty,
  emptyText,
  children,
}: {
  title: string;
  subtitle: string;
  onAdd: () => void;
  addLabel: string;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-forest">{title}</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Button variant="gold" className="rounded-lg" onClick={onAdd}>
          <PlusCircle className="h-4 w-4" /> {addLabel}
        </Button>
      </div>
      <div className="mt-5 space-y-3">
        {empty ? (
          <div className="rounded-3xl border border-dashed border-border bg-muted/40 py-14 text-center text-sm text-muted-foreground">
            {emptyText}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: typeof Star; label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card p-4 shadow-premium">
      <span className={cn("grid h-11 w-11 place-items-center rounded-2xl", accent ? "bg-gradient-gold text-forest-900" : "bg-gradient-forest text-gold")}>
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 font-display text-2xl font-bold text-forest">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-border pb-2">
      <h3 className="font-display text-base font-bold text-forest">{children}</h3>
    </div>
  );
}

function FormHeader({ title, onCancel }: { title: string; onCancel: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="font-display text-xl font-bold text-forest">{title}</h2>
      <button type="button" onClick={onCancel} className="text-sm font-medium text-forest-600 hover:text-gold">
        ← Back
      </button>
    </div>
  );
}
function SaveButtons({ saving, editing, onCancel }: { saving: boolean; editing: boolean; onCancel: () => void }) {
  return (
    <div className="flex gap-2">
      <Button type="submit" variant="gold" size="lg" className="rounded-lg" disabled={saving}>
        {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : editing ? "Save changes" : "Publish"}
      </Button>
      <Button type="button" variant="outline" size="lg" className="rounded-lg" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
function ErrorBox({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">{children}</div>;
}
function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</p>
      <p className="font-medium text-forest">{v}</p>
    </div>
  );
}
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-forest">
        {label} {required && <span className="text-gold-600">*</span>}
      </span>
      {children}
    </label>
  );
}
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    approved: { label: "Live", cls: "bg-forest-50 text-forest-600" },
    pending: { label: "Pending", cls: "bg-gold/20 text-gold-700" },
    rejected: { label: "Rejected", cls: "bg-red-50 text-red-600" },
    suspended: { label: "Suspended", cls: "bg-red-50 text-red-600" },
  };
  const s = map[status] ?? map.pending;
  return <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase", s.cls)}>{s.label}</span>;
}
function BookingStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    accepted: { label: "Accepted", cls: "bg-forest-50 text-forest-600" },
    completed: { label: "Completed", cls: "bg-forest-50 text-forest-600" },
    rejected: { label: "Rejected", cls: "bg-red-50 text-red-600" },
    pending: { label: "Pending", cls: "bg-gold/20 text-gold-700" },
  };
  const s = map[status] ?? map.pending;
  return <span className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase", s.cls)}>{s.label}</span>;
}
