"use client";

import * as React from "react";
import { useDashboardDrill, DashboardBack } from "@/components/dashboard/dashboard-drill";
import {
  LayoutDashboard,
  UserRound,
  ListChecks,
  Images,
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
  Camera,
  Send,
  Eye,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ImageUpload,
  AvatarUpload,
} from "@/components/ui/image-upload";
import { ChatModal } from "@/components/chat/chat-modal";
import { PaymentSettings } from "@/components/payments/payment-settings";
import { PaymentsManager } from "@/components/payments/payments-manager";
import { MessagesInbox } from "@/components/chat/messages-inbox";
import { ContactAdminButton } from "@/components/chat/contact-admin-button";
import { AccountSecurity } from "@/components/account/account-security";
import { OwnerCrm } from "@/components/crm/owner-crm";
import { useUnread } from "@/lib/use-unread";
import { type User } from "@/components/auth/auth-context";
import { type BookingRow } from "@/lib/bookings";
import {
  getMediaProviderByOwner,
  createMediaProvider,
  updateMediaProvider,
  getPortfolioByProvider,
  addPortfolioItem,
  deletePortfolioItem,
  SERVICE_TYPES,
  PORTFOLIO_TYPES,
  PHOTO_CATEGORIES,
  portfolioCategoriesFor,
  type MediaProviderRow,
  type MediaPortfolioRow,
} from "@/lib/media";
import {
  getMediaServicesByProvider,
  createMediaService,
  updateMediaService,
  deleteMediaService,
  MEDIA_SERVICE_PRESETS,
  type MediaServiceRow,
} from "@/lib/media-services";
import {
  getMediaBookingsByOwner,
  setMediaBookingStatus,
  setMediaDeliveryLink,
  mediaBookingRef,
  getMediaBlockedDates,
  blockMediaDates,
  unblockMediaDate,
  enumerateDates,
  type MediaBookingRow,
  type MediaAvailabilityRow,
} from "@/lib/media-bookings";
import { MediaDetail } from "@/components/listings/media-detail";
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

type Tab =
  | "overview"
  | "profile"
  | "services"
  | "portfolio"
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
  { id: "portfolio", label: "Portfolio", icon: Images },
  { id: "availability", label: "Availability", icon: CalendarX },
  { id: "bookings", label: "Booking Requests", icon: CalendarCheck },
  { id: "payments", label: "Payments", icon: Wallet },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "reviews", label: "Reviews", icon: Star },
  { id: "earnings", label: "Earnings", icon: Wallet },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "crm", label: "CRM & Insights", icon: BarChart3 },
];

export function MediaDashboard({
  user,
  onSignOut,
}: {
  user: User;
  onSignOut: () => void;
}) {
  const [tab, setTab] = React.useState<Tab>("profile");
  const drill = useDashboardDrill();
  const [provider, setProvider] = React.useState<MediaProviderRow | null>(null);
  const [services, setServices] = React.useState<MediaServiceRow[]>([]);
  const [portfolio, setPortfolio] = React.useState<MediaPortfolioRow[]>([]);
  const [bookings, setBookings] = React.useState<MediaBookingRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [chatBooking, setChatBooking] = React.useState<BookingRow | null>(null);

  const refresh = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const p = await getMediaProviderByOwner(user.email);
    setProvider(p);
    if (p) {
      const [s, pf, b] = await Promise.all([
        getMediaServicesByProvider(p.id),
        getPortfolioByProvider(p.id),
        getMediaBookingsByOwner(user.email),
      ]);
      setServices(s);
      setPortfolio(pf);
      setBookings(b);
    }
    if (!silent) setLoading(false);
  }, [user.email]);

  React.useEffect(() => {
    refresh();
    const t = setInterval(() => { if (document.visibilityState === "visible") refresh(true); }, 45000);
    return () => clearInterval(t);
  }, [refresh]);

  const toRow = (b: MediaBookingRow): BookingRow =>
    ({
      ...b,
      hotel_id: b.provider_id,
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
  const openChat = (b: MediaBookingRow) => openChatRow(toRow(b));

  // Open a specific chat from a navbar notification.
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

  const handleBookingAct = async (
    id: string,
    status: "accepted" | "rejected" | "completed"
  ) => {
    const b = bookings.find((x) => x.id === id);
    await setMediaBookingStatus(id, status);
    if (b && status !== "completed") {
      sendEmail(
        b.customer_email,
        status === "accepted"
          ? "Your Rego booking is confirmed"
          : "Rego booking update",
        bookingStatusEmail({
          name: b.customer_name ?? "Guest",
          hotel: b.item_title,
          ref: mediaBookingRef(b.id),
          accepted: status === "accepted",
        })
      );
    }
    if (b) {
      await sendBookingStatusNotification({
        booking_id: b.id,
        owner_email: user.email,
        owner_name: provider?.name ?? user.name,
        ref: mediaBookingRef(b.id),
        itemTitle: b.item_title,
        status,
      });
    }
    await refresh();
  };

  const handleDelivery = async (id: string, link: string) => {
    await setMediaDeliveryLink(id, link);
    await refresh();
  };

  if (loading) {
    return (
      <div className="container-px py-24 text-center text-muted-foreground">
        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="container-px py-10">
        <h1 className="font-display text-3xl font-bold text-forest">
          Welcome, {user.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Create your media profile to start receiving shoot bookings.
        </p>
        <div className="mt-8 max-w-3xl">
          <ProviderForm user={user} provider={null} onSaved={refresh} />
        </div>
      </div>
    );
  }

  return (
    <div className="container-px py-10">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-3xl font-bold text-forest">{provider.name}</h1>
        <StatusBadge status={provider.status} />
        {provider.verified && (
          <span className="inline-flex items-center gap-1 rounded-full bg-forest-600 px-2.5 py-1 text-xs font-semibold text-white">
            <CheckCircle2 className="h-3.5 w-3.5" /> Verified
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2.5 py-1 text-xs font-semibold text-gold-700">
          Independent
        </span>
        {(provider as { pending_changes?: unknown }).pending_changes != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2.5 py-1 text-xs font-semibold text-gold-700">
            Edits pending admin review
          </span>
        )}
      </div>
      <p className="mt-1 text-muted-foreground">
        Manage your profile, services, portfolio, availability and bookings —
        your profile goes live once an admin approves it.
      </p>
      <div className="mt-3">
        <ContactAdminButton ownerEmail={user.email} ownerName={user.name} ownerAvatar={user.avatar} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr] rego-dash" {...drill.gridProps}>
        <DashboardBack onClick={drill.back} />
        <aside>
          <div className="sticky top-24 rounded-3xl border border-border/70 bg-card p-3 shadow-premium">
            <div className="flex items-center gap-3 border-b border-border p-3">
              <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-gradient-gold text-forest-900">
                {provider.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={provider.logo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Camera className="h-6 w-6" />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-forest">{user.name}</p>
                <span className="mt-1 inline-block rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-gold-700">
                  Media · Partner
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
                <MediaDetail provider={provider} services={services} portfolio={portfolio} company={null} relatedPackages={[]} />
              </div>
            </div>
          )}
          {tab === "crm" && <OwnerCrm user={user} />}
          {tab === "profile" && (<><ProviderForm user={user} provider={provider} onSaved={refresh} /><AccountSecurity /></>)}
          {tab === "services" && (
            <ServicesManager provider={provider} user={user} items={services} onChange={refresh} />
          )}
          {tab === "portfolio" && (
            <PortfolioManager provider={provider} user={user} items={portfolio} onChange={refresh} />
          )}
          {tab === "availability" && (
            <AvailabilityEditor providerId={provider.id} ownerEmail={user.email} />
          )}
          {tab === "payments" && (
            <div className="space-y-8">
              <PaymentsManager table="media_bookings" bookings={bookings} onChange={refresh} senderEmail={user.email} senderName={user.name} />
              <PaymentSettings tables={["media_providers"]} ownerEmail={user.email} />
            </div>
          )}

          {tab === "bookings" && (
            <BookingsPanel bookings={bookings} onAct={handleBookingAct} onDelivery={handleDelivery} onChat={openChat} unread={unread} />
          )}
          {tab === "messages" && (
            <MessagesInbox
              bookings={bookingRows}
              unread={unread}
              otherLabelFor={(b) => b.customer_name ?? b.customer_email}
              onOpen={openChatRow}
            />
          )}
          {tab === "reviews" && <ReviewsPanel provider={provider} />}
          {tab === "earnings" && <EarningsPanel bookings={bookings} />}
          {tab === "analytics" && (
            <AnalyticsPanel provider={provider} services={services} portfolio={portfolio} bookings={bookings} />
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
 * Provider profile form
 * ============================================================ */

function ProviderForm({
  user,
  provider,
  onSaved,
}: {
  user: User;
  provider: MediaProviderRow | null;
  onSaved: () => void;
}) {
  const editing = !!provider;
  const [f, setF] = React.useState({
    name: provider?.name ?? user.name,
    logo: provider?.logo ?? "",
    cover_image: provider?.cover_image ?? "",
    cnic: provider?.cnic ?? "",
    phone: provider?.phone ?? "",
    whatsapp: provider?.whatsapp ?? "",
    email: provider?.email ?? user.email,
    city: provider?.city ?? "",
    location: provider?.location ?? "Gilgit",
    areas: joinList(provider?.areas),
    service_type: provider?.service_type ?? "Photographer",
    experience_years: provider?.experience_years ? String(provider.experience_years) : "",
    languages: joinList(provider?.languages),
    bio: provider?.bio ?? "",
    equipment: provider?.equipment ?? "",
    camera_models: provider?.camera_models ?? "",
    drone_available: provider?.drone_available ?? false,
    drone_license: provider?.drone_license ?? "",
    editing_included: provider?.editing_included ?? true,
    delivery_time: provider?.delivery_time ?? "",
    starting_price: provider?.starting_price ? String(provider.starting_price) : "",
    social_links: joinList(provider?.social_links),
    portfolio_link: provider?.portfolio_link ?? "",
    seasonal_availability: provider?.seasonal_availability ?? "",
    cnic_doc: provider?.cnic_doc ?? "",
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saved, setSaved] = React.useState(false);
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!f.name.trim() || !Number(f.starting_price)) {
      setError("Please enter your name and a valid starting price.");
      return;
    }
    setSaving(true);
    const payload = {
      company_id: null,
      company_name: null,
      name: f.name.trim(),
      logo: f.logo.trim() || `https://i.pravatar.cc/300?u=${encodeURIComponent(f.name.trim())}`,
      cover_image: f.cover_image.trim() || null,
      cnic: f.cnic.trim() || null,
      phone: f.phone.trim() || null,
      whatsapp: f.whatsapp.trim() || null,
      email: f.email.trim() || null,
      city: f.city.trim() || null,
      location: f.location.trim() || null,
      areas: splitList(f.areas),
      service_type: f.service_type,
      experience_years: num(f.experience_years),
      languages: splitList(f.languages),
      bio: f.bio.trim() || null,
      equipment: f.equipment.trim() || null,
      camera_models: f.camera_models.trim() || null,
      drone_available: f.drone_available,
      drone_license: f.drone_license.trim() || null,
      editing_included: f.editing_included,
      delivery_time: f.delivery_time.trim() || null,
      starting_price: Number(f.starting_price),
      social_links: splitList(f.social_links),
      portfolio_link: f.portfolio_link.trim() || null,
      seasonal_availability: f.seasonal_availability.trim() || null,
      cnic_doc: f.cnic_doc.trim() || null,
      owner_email: user.email,
    };
    const { error: dbError } = editing
      ? await updateMediaProvider(provider!.id, payload)
      : await createMediaProvider(payload);
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
          {editing ? "Media profile" : "Create your media profile"}
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

      <SectionTitle>About</SectionTitle>
      <div className="flex items-center gap-4">
        <AvatarUpload value={f.logo} onChange={(url) => set({ logo: url })} />
        <div className="flex-1">
          <Field label="Full name / business name" required><input value={f.name} onChange={(e) => set({ name: e.target.value })} className="auth-input" /></Field>
        </div>
      </div>
      <div>
        <span className="mb-1.5 block text-sm font-semibold text-forest">Cover image</span>
        <ImageUpload value={f.cover_image} onChange={(url) => set({ cover_image: url })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Service type">
          <select value={f.service_type} onChange={(e) => set({ service_type: e.target.value })} className="auth-input">
            {SERVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Experience (years)"><input type="number" value={f.experience_years} onChange={(e) => set({ experience_years: e.target.value })} className="auth-input" /></Field>
        <Field label="Starting price (PKR)" required><input type="number" value={f.starting_price} onChange={(e) => set({ starting_price: e.target.value })} className="auth-input" /></Field>
      </div>
      <Field label="Bio / about"><textarea rows={3} value={f.bio} onChange={(e) => set({ bio: e.target.value })} className="auth-input resize-none" /></Field>

      <SectionTitle>Contact</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Phone"><input value={f.phone} onChange={(e) => set({ phone: e.target.value })} className="auth-input" placeholder="+92 3xx…" /></Field>
        <Field label="WhatsApp"><input value={f.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} className="auth-input" placeholder="+92 3xx…" /></Field>
        <Field label="Email"><input value={f.email} onChange={(e) => set({ email: e.target.value })} className="auth-input" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="City / district"><input value={f.city} onChange={(e) => set({ city: e.target.value })} className="auth-input" placeholder="Skardu" /></Field>
        <Field label="Base location"><input value={f.location} onChange={(e) => set({ location: e.target.value })} className="auth-input" /></Field>
        <Field label="Areas covered (comma separated)"><input value={f.areas} onChange={(e) => set({ areas: e.target.value })} className="auth-input" placeholder="Skardu, Hunza" /></Field>
      </div>
      <Field label="Languages spoken (comma separated)"><input value={f.languages} onChange={(e) => set({ languages: e.target.value })} className="auth-input" placeholder="English, Urdu, Balti" /></Field>

      <SectionTitle>Equipment &amp; delivery</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Equipment details"><textarea rows={2} value={f.equipment} onChange={(e) => set({ equipment: e.target.value })} className="auth-input resize-none" placeholder="Sony A7IV, gimbal, lighting…" /></Field>
        <Field label="Camera models"><textarea rows={2} value={f.camera_models} onChange={(e) => set({ camera_models: e.target.value })} className="auth-input resize-none" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Delivery time"><input value={f.delivery_time} onChange={(e) => set({ delivery_time: e.target.value })} className="auth-input" placeholder="7–10 days" /></Field>
        <label className="flex items-end gap-2 pb-3 text-sm font-medium text-forest">
          <input type="checkbox" checked={f.drone_available} onChange={(e) => set({ drone_available: e.target.checked })} className="h-4 w-4 accent-forest-600" /> Drone available
        </label>
        <label className="flex items-end gap-2 pb-3 text-sm font-medium text-forest">
          <input type="checkbox" checked={f.editing_included} onChange={(e) => set({ editing_included: e.target.checked })} className="h-4 w-4 accent-forest-600" /> Editing included
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Portfolio link"><input value={f.portfolio_link} onChange={(e) => set({ portfolio_link: e.target.value })} className="auth-input" placeholder="https://…" /></Field>
        <Field label="Social media links (comma separated)"><input value={f.social_links} onChange={(e) => set({ social_links: e.target.value })} className="auth-input" /></Field>
        <Field label="Seasonal availability"><input value={f.seasonal_availability} onChange={(e) => set({ seasonal_availability: e.target.value })} className="auth-input" placeholder="Apr – Oct" /></Field>
      </div>

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
          <span className="mb-1.5 block text-sm font-semibold text-forest">Drone license / permit {f.drone_available ? "" : "(if applicable)"}</span>
          <ImageUpload value={f.drone_license} onChange={(url) => set({ drone_license: url })} />
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
  provider,
  user,
  items,
  onChange,
}: {
  provider: MediaProviderRow;
  user: User;
  items: MediaServiceRow[];
  onChange: () => void;
}) {
  const [editing, setEditing] = React.useState<MediaServiceRow | null>(null);
  const [adding, setAdding] = React.useState(false);

  if (adding || editing) {
    return (
      <ServiceForm
        provider={provider}
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
      subtitle="Wedding, travel, drone, reels and more — these appear on your public profile."
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
              {[s.duration, s.edited_photos ? `${s.edited_photos} photos` : "", s.videos ? `${s.videos} videos` : "", s.drone_included ? "drone" : ""].filter(Boolean).join(" · ") || "—"}
            </p>
            {s.description && <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(s)} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-forest hover:bg-muted"><Pencil className="h-3.5 w-3.5" /> Edit</button>
            <button onClick={async () => { await deleteMediaService(s.id); onChange(); }} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
          </div>
        </div>
      ))}
    </ManagerShell>
  );
}

function ServiceForm({
  provider,
  user,
  item,
  onDone,
  onCancel,
}: {
  provider: MediaProviderRow;
  user: User;
  item: MediaServiceRow | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const editing = !!item;
  const [f, setF] = React.useState({
    title: item?.title ?? MEDIA_SERVICE_PRESETS[0],
    description: item?.description ?? "",
    price: item?.price ? String(item.price) : "",
    duration: item?.duration ?? "Full Day",
    deliverables: item?.deliverables ?? "",
    edited_photos: item?.edited_photos ? String(item.edited_photos) : "",
    videos: item?.videos ? String(item.videos) : "",
    raw_files: item?.raw_files ?? false,
    drone_included: item?.drone_included ?? false,
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
      provider_id: provider.id,
      title: f.title.trim(),
      description: f.description.trim() || null,
      price: Number(f.price),
      duration: f.duration.trim() || null,
      deliverables: f.deliverables.trim() || null,
      edited_photos: num(f.edited_photos),
      videos: num(f.videos),
      raw_files: f.raw_files,
      drone_included: f.drone_included,
      area: f.area.trim() || null,
      owner_email: user.email,
    };
    const { error: dbError } = editing
      ? await updateMediaService(item!.id, payload)
      : await createMediaService(payload);
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
          <input list="media-service-presets" value={f.title} onChange={(e) => set({ title: e.target.value })} className="auth-input" />
          <datalist id="media-service-presets">
            {MEDIA_SERVICE_PRESETS.map((p) => <option key={p} value={p} />)}
          </datalist>
        </Field>
        <Field label="Price (PKR)" required><input type="number" value={f.price} onChange={(e) => set({ price: e.target.value })} className="auth-input" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Duration"><input value={f.duration} onChange={(e) => set({ duration: e.target.value })} className="auth-input" placeholder="Full Day / Half Day" /></Field>
        <Field label="Edited photos"><input type="number" value={f.edited_photos} onChange={(e) => set({ edited_photos: e.target.value })} className="auth-input" /></Field>
        <Field label="Videos"><input type="number" value={f.videos} onChange={(e) => set({ videos: e.target.value })} className="auth-input" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Deliverables"><textarea rows={2} value={f.deliverables} onChange={(e) => set({ deliverables: e.target.value })} className="auth-input resize-none" placeholder="Edited gallery, highlight reel…" /></Field>
        <Field label="Area covered"><input value={f.area} onChange={(e) => set({ area: e.target.value })} className="auth-input" /></Field>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm font-medium text-forest">
          <input type="checkbox" checked={f.raw_files} onChange={(e) => set({ raw_files: e.target.checked })} className="h-4 w-4 accent-forest-600" /> Raw files included
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-forest">
          <input type="checkbox" checked={f.drone_included} onChange={(e) => set({ drone_included: e.target.checked })} className="h-4 w-4 accent-forest-600" /> Drone included
        </label>
      </div>
      <Field label="Description"><textarea rows={3} value={f.description} onChange={(e) => set({ description: e.target.value })} className="auth-input resize-none" /></Field>
      <SaveButtons saving={saving} editing={editing} onCancel={onCancel} />
    </form>
  );
}

/* ============================================================
 * Portfolio manager
 * ============================================================ */

function PortfolioManager({
  provider,
  user,
  items,
  onChange,
}: {
  provider: MediaProviderRow;
  user: User;
  items: MediaPortfolioRow[];
  onChange: () => void;
}) {
  const [type, setType] = React.useState<string>("photo");
  const [f, setF] = React.useState({
    title: "",
    category: PHOTO_CATEGORIES[0],
    location: "",
    project_date: "",
    drone_model: "",
    url: "",
    video_url: "",
    description: "",
  });
  const [busy, setBusy] = React.useState(false);
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  const cats = portfolioCategoriesFor(type);

  const add = async () => {
    if (!f.url && !f.video_url) return;
    setBusy(true);
    await addPortfolioItem({
      provider_id: provider.id,
      type,
      url: f.url || "https://picsum.photos/seed/portfolio/600/400",
      title: f.title.trim() || null,
      category: f.category,
      location: f.location.trim() || null,
      project_date: f.project_date || null,
      drone_model: f.drone_model.trim() || null,
      video_url: f.video_url.trim() || null,
      description: f.description.trim() || null,
      caption: f.title.trim() || null,
      owner_email: user.email,
    });
    setBusy(false);
    setF({ title: "", category: cats[0], location: "", project_date: "", drone_model: "", url: "", video_url: "", description: "" });
    onChange();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-premium">
        <h2 className="font-display text-xl font-bold text-forest">Portfolio / Showcase</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Showcase your projects — photos, drone videos and reels. Customers
          evaluate your work here before booking.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Type">
                <select value={type} onChange={(e) => { setType(e.target.value); set({ category: portfolioCategoriesFor(e.target.value)[0] }); }} className="auth-input">
                  {PORTFOLIO_TYPES.map((t) => <option key={t} value={t}>{t === "reel" ? "Drone Reel / Short" : t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </Field>
              <Field label="Category">
                <select value={f.category} onChange={(e) => set({ category: e.target.value })} className="auth-input">
                  {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Project title"><input value={f.title} onChange={(e) => set({ title: e.target.value })} className="auth-input" placeholder="e.g. Attabad Lake Cinematic" /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Location"><input value={f.location} onChange={(e) => set({ location: e.target.value })} className="auth-input" placeholder="Hunza" /></Field>
              <Field label="Project date"><input type="date" value={f.project_date} onChange={(e) => set({ project_date: e.target.value })} className="auth-input" /></Field>
            </div>
            <Field label="Drone / camera model"><input value={f.drone_model} onChange={(e) => set({ drone_model: e.target.value })} className="auth-input" placeholder="DJI Mavic 3" /></Field>
          </div>
          <div className="space-y-3">
            <div>
              <span className="mb-1.5 block text-sm font-semibold text-forest">Thumbnail image</span>
              <ImageUpload value={f.url} onChange={(url) => set({ url })} />
            </div>
            {(type === "video" || type === "reel") && (
              <Field label="Video link (YouTube / Vimeo / MP4)"><input value={f.video_url} onChange={(e) => set({ video_url: e.target.value })} className="auth-input" placeholder="https://youtube.com/watch?v=…" /></Field>
            )}
            <Field label="Description"><textarea rows={2} value={f.description} onChange={(e) => set({ description: e.target.value })} className="auth-input resize-none" /></Field>
            <Button type="button" variant="gold" className="rounded-lg" onClick={add} disabled={busy || (!f.url && !f.video_url)}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><PlusCircle className="h-4 w-4" /> Add project</>}
            </Button>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-muted/40 py-14 text-center text-sm text-muted-foreground">No portfolio projects yet.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <div key={p.id} className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-premium transition-all duration-300 hover:-translate-y-1 hover:shadow-premium-lg">
              <div className="relative h-36 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.title ?? ""} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                <span className="absolute left-2 top-2 rounded-full bg-forest-900/70 px-2 py-0.5 text-[9px] font-bold uppercase text-white">{p.type}</span>
                {p.video_url && <span className="absolute right-2 bottom-2 rounded-full bg-white/90 px-2 py-0.5 text-[9px] font-bold text-forest">▶ video</span>}
                <button onClick={async () => { await deletePortfolioItem(p.id); onChange(); }} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-red-600 opacity-0 transition-opacity group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <div className="p-3">
                <p className="truncate font-display text-sm font-semibold text-forest">{p.title ?? "Untitled project"}</p>
                <p className="truncate text-xs text-muted-foreground">{[p.category, p.location].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * Availability editor
 * ============================================================ */

function AvailabilityEditor({ providerId, ownerEmail }: { providerId: string; ownerEmail: string }) {
  const [blocks, setBlocks] = React.useState<MediaAvailabilityRow[]>([]);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [reason, setReason] = React.useState("blocked");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    setBlocks(await getMediaBlockedDates(providerId));
  }, [providerId]);
  React.useEffect(() => { load(); }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!from) { setError("Pick a start date."); return; }
    setBusy(true);
    const dates = enumerateDates(from, to || from);
    const { error: dbError } = await blockMediaDates({ providerId, dates, reason, ownerEmail });
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
              <button onClick={async () => { await unblockMediaDate(b.id); load(); }} className="text-red-500 hover:text-red-700">
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
  onDelivery,
  onChat,
  unread,
}: {
  bookings: MediaBookingRow[];
  onAct: (id: string, status: "accepted" | "rejected" | "completed") => void;
  onDelivery: (id: string, link: string) => void;
  onChat: (b: MediaBookingRow) => void;
  unread: Set<string>;
}) {
  const [linkDrafts, setLinkDrafts] = React.useState<Record<string, string>>({});

  if (bookings.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-muted/40 py-16 text-center">
        <CalendarCheck className="mx-auto h-10 w-10 text-forest-600" />
        <p className="mt-2 font-display text-lg font-semibold text-forest">No booking requests yet</p>
        <p className="text-sm text-muted-foreground">Shoot bookings appear here.</p>
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
                {mediaBookingRef(b.id)}{b.service_title ? ` · ${b.service_title}` : ""}
              </p>
              <p className="font-display text-base font-semibold text-forest">{b.item_title}</p>
              <p className="text-sm font-semibold text-forest">
                {formatPrice(b.total_price)} · {b.people} {b.people > 1 ? "people" : "person"}
              </p>
            </div>
            {b.status !== "pending" && <BookingStatusBadge status={b.status} />}
          </div>
          <div className="mt-3 grid gap-2 rounded-xl bg-forest-50/50 p-3 text-sm sm:grid-cols-2">
            <KV k="Customer" v={b.customer_name ?? "—"} />
            <KV k="Phone" v={b.customer_phone ?? "—"} />
            <KV k="Location" v={b.location ?? "—"} />
            <KV k="Shoot type" v={b.shoot_type ?? "—"} />
            <KV k="Date" v={b.start_date ?? "—"} />
            <KV k="Duration" v={b.duration ?? "—"} />
            <KV k="Drone" v={b.drone_required ? "Required" : "No"} />
            <KV k="Editing" v={b.editing_required ? "Required" : "No"} />
          </div>
          {b.notes && (
            <p className="mt-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-forest"><span className="font-semibold">Note:</span> {b.notes}</p>
          )}

          {(b.status === "accepted" || b.status === "completed") && (
            <div className="mt-3 flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3 sm:flex-row sm:items-center">
              <input
                value={linkDrafts[b.id] ?? b.delivery_link ?? ""}
                onChange={(e) => setLinkDrafts((d) => ({ ...d, [b.id]: e.target.value }))}
                placeholder="Final delivery link (Drive, WeTransfer…)"
                className="auth-input flex-1"
              />
              <Button type="button" variant="outline" className="rounded-lg" onClick={() => onDelivery(b.id, linkDrafts[b.id] ?? b.delivery_link ?? "")}>
                <Send className="h-4 w-4" /> Save link
              </Button>
            </div>
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
            {b.status === "accepted" && (
              <button onClick={() => onAct(b.id, "completed")} className="flex items-center gap-1.5 rounded-xl bg-gold px-3.5 py-2 text-sm font-semibold text-forest-900 shadow-soft hover:-translate-y-0.5">
                <CheckCircle2 className="h-4 w-4" /> Mark shoot completed
              </button>
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

function ReviewsPanel({ provider }: { provider: MediaProviderRow }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-premium">
      <div className="flex items-center gap-3">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-forest text-gold">
          <Star className="h-6 w-6 fill-gold" />
        </span>
        <div>
          <p className="font-display text-3xl font-extrabold text-forest">
            {Number(provider.rating || 0).toFixed(1)}
          </p>
          <p className="text-sm text-muted-foreground">
            {provider.reviews} review{provider.reviews === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Only customers with a confirmed booking can leave a review, so every
        rating is from a real shoot.
      </p>
    </div>
  );
}

function EarningsPanel({ bookings }: { bookings: MediaBookingRow[] }) {
  const earned = bookings.filter((b) => b.status === "accepted" || b.status === "completed");
  const total = earned.reduce((s, b) => s + (b.total_price || 0), 0);
  const month = new Date().toISOString().slice(0, 7);
  const months: { label: string; amount: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toISOString().slice(0, 7);
    months.push({
      label: d.toLocaleString("default", { month: "short" }),
      amount: earned.filter((b) => b.created_at?.slice(0, 7) === key).reduce((s, b) => s + (b.total_price || 0), 0),
    });
  }
  const max = Math.max(1, ...months.map((m) => m.amount));
  const thisMonth = earned.filter((b) => b.created_at?.slice(0, 7) === month).reduce((s, b) => s + (b.total_price || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={Wallet} label="Total earnings" value={formatPrice(total)} accent />
        <Stat icon={Wallet} label="This month" value={formatPrice(thisMonth)} />
        <Stat icon={CheckCircle2} label="Completed shoots" value={bookings.filter((b) => b.status === "completed").length} />
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
  provider,
  services,
  portfolio,
  bookings,
}: {
  provider: MediaProviderRow;
  services: MediaServiceRow[];
  portfolio: MediaPortfolioRow[];
  bookings: MediaBookingRow[];
}) {
  const accepted = bookings.filter((b) => b.status === "accepted").length;
  const pending = bookings.filter((b) => b.status === "pending").length;
  const rejected = bookings.filter((b) => b.status === "rejected").length;
  const completed = bookings.filter((b) => b.status === "completed").length;
  const counts = new Map<string, number>();
  for (const b of bookings) {
    const key = b.service_title || "Custom shoot";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={CalendarCheck} label="Total bookings" value={bookings.length} accent />
        <Stat icon={Database} label="Pending" value={pending} />
        <Stat icon={CheckCircle2} label="Confirmed" value={accepted} />
        <Stat icon={CheckCircle2} label="Completed shoots" value={completed} />
        <Stat icon={XCircle} label="Cancelled" value={rejected} />
        <Stat icon={ListChecks} label="Services" value={services.length} />
        <Stat icon={Images} label="Portfolio views" value={provider.portfolio_views} />
        <Stat icon={Star} label="Rating" value={Number(provider.rating || 0).toFixed(1)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
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
        <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
          <p className="text-sm text-muted-foreground">Portfolio</p>
          <p className="font-display text-xl font-bold text-forest">{portfolio.length} items</p>
          <p className="text-sm text-muted-foreground">{provider.portfolio_views} total views</p>
        </div>
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

function Stat({ icon: Icon, label, value, accent }: { icon: typeof Camera; label: string; value: string | number; accent?: boolean }) {
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
