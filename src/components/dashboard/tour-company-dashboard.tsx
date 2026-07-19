"use client";

import * as React from "react";
import { useDashboardDrill, DashboardBack } from "@/components/dashboard/dashboard-drill";
import Link from "next/link";
import {
  LayoutDashboard,
  Briefcase,
  Map,
  Bus,
  UserRound,
  Camera,
  Mountain,
  CalendarCheck,
  MessageSquare,
  Star,
  BarChart3,
  LogOut,
  PlusCircle,
  Trash2,
  Pencil,
  Loader2,
  CheckCircle2,
  XCircle,
  MapPin,
  Database,
  Wallet,
  Users,
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
import { MediaTeamManager } from "@/components/dashboard/media-team-manager";
import { TourCompanyProfile } from "@/components/listings/tour-company-profile";
import { useUnread } from "@/lib/use-unread";
import { useAuth, type User } from "@/components/auth/auth-context";
import { type BookingRow } from "@/lib/bookings";
import {
  getCompanyByOwner,
  createCompany,
  updateCompany,
  getPackagesByCompany,
  createPackage,
  updatePackage,
  deletePackage,
  getTransportsByCompany,
  createTransport,
  updateTransport,
  deleteTransport,
  getGuidesByCompany,
  createGuide,
  updateGuide,
  deleteGuide,
  type TourCompanyRow,
  type TourPackageRow,
  type TransportRow,
  type TourGuideRow,
} from "@/lib/tour-companies";
import {
  getTourBookingsByOwner,
  setTourBookingStatus,
  tourBookingRef,
  type TourBookingRow,
} from "@/lib/tour-bookings";
import { sendEmail, bookingStatusEmail } from "@/lib/email";
import { sendBookingStatusNotification } from "@/lib/messages";
import { cn, formatPrice } from "@/lib/utils";

/* ---------------- helpers ---------------- */
const splitList = (s: string) =>
  s.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean);
const joinList = (a: string[] | null | undefined) => (a ?? []).join(", ");
const num = (v: string) => {
  const n = Number(v);
  return v.trim() && !Number.isNaN(n) ? n : null;
};

const PACKAGE_TYPES = [
  "Family",
  "Couple",
  "Group",
  "Adventure",
  "Cultural",
  "Honeymoon",
  "Custom",
];
const VEHICLE_TYPES = ["Jeep", "Car", "Van", "Coaster", "Bus", "Bike"];
const SPECIALIZATIONS = ["Trekking", "Cultural", "City", "Mountain", "Adventure"];

type Tab =
  | "overview"
  | "profile"
  | "packages"
  | "transport"
  | "guides"
  | "media"
  | "activities"
  | "bookings"
  | "payments"
  | "messages"
  | "reviews"
  | "analytics"
  | "crm";

const nav: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: Eye },
  { id: "profile", label: "Company Profile", icon: Briefcase },
  { id: "packages", label: "Tour Packages", icon: Map },
  { id: "transport", label: "Transport / Vehicles", icon: Bus },
  { id: "guides", label: "Tour Guides", icon: UserRound },
  { id: "media", label: "Media Team", icon: Camera },
  { id: "activities", label: "Activities", icon: Mountain },
  { id: "bookings", label: "Bookings", icon: CalendarCheck },
  { id: "payments", label: "Payments", icon: Wallet },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "reviews", label: "Reviews", icon: Star },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "crm", label: "CRM & Insights", icon: BarChart3 },
];

export function TourCompanyDashboard({
  user,
  onSignOut,
}: {
  user: User;
  onSignOut: () => void;
}) {
  const [tab, setTab] = React.useState<Tab>("profile");
  const drill = useDashboardDrill();
  const [company, setCompany] = React.useState<TourCompanyRow | null>(null);
  const [packages, setPackages] = React.useState<TourPackageRow[]>([]);
  const [transports, setTransports] = React.useState<TransportRow[]>([]);
  const [guides, setGuides] = React.useState<TourGuideRow[]>([]);
  const [bookings, setBookings] = React.useState<TourBookingRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [chatBooking, setChatBooking] = React.useState<BookingRow | null>(null);

  const refresh = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const c = await getCompanyByOwner(user.email);
    setCompany(c);
    if (c) {
      const [p, t, g, b] = await Promise.all([
        getPackagesByCompany(c.id),
        getTransportsByCompany(c.id),
        getGuidesByCompany(c.id),
        getTourBookingsByOwner(user.email),
      ]);
      setPackages(p);
      setTransports(t);
      setGuides(g);
      setBookings(b);
    }
    if (!silent) setLoading(false);
  }, [user.email]);

  React.useEffect(() => {
    refresh();
    const t = setInterval(() => { if (document.visibilityState === "visible") refresh(true); }, 45000);
    return () => clearInterval(t);
  }, [refresh]);

  const toRow = (b: TourBookingRow): BookingRow =>
    ({
      ...b,
      hotel_id: b.company_id,
      hotel_title: b.item_title,
      room_name: null,
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
  const openChat = (b: TourBookingRow) => openChatRow(toRow(b));

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

  const handleBookingAct = async (
    id: string,
    status: "accepted" | "rejected"
  ) => {
    const b = bookings.find((x) => x.id === id);
    await setTourBookingStatus(id, status);
    if (b) {
      sendEmail(
        b.customer_email,
        status === "accepted"
          ? "Your Rego booking is confirmed"
          : "Rego booking update",
        bookingStatusEmail({
          name: b.customer_name ?? "Guest",
          hotel: b.item_title,
          ref: tourBookingRef(b.id),
          accepted: status === "accepted",
        })
      );
      await sendBookingStatusNotification({
        booking_id: b.id,
        owner_email: user.email,
        owner_name: company?.name ?? user.name,
        ref: tourBookingRef(b.id),
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

  // No company yet → onboarding form.
  if (!company) {
    return (
      <div className="container-px py-10">
        <h1 className="font-display text-3xl font-bold text-forest">
          Welcome, {user.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Set up your tour company profile to start adding packages, transport
          and guides.
        </p>
        <div className="mt-8 max-w-3xl">
          <CompanyForm
            user={user}
            company={null}
            onSaved={refresh}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container-px py-10">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-3xl font-bold text-forest">
          {company.name}
        </h1>
        <StatusBadge status={company.status} />
        {company.verified && (
          <span className="inline-flex items-center gap-1 rounded-full bg-forest-600 px-2.5 py-1 text-xs font-semibold text-white">
            <CheckCircle2 className="h-3.5 w-3.5" /> Verified
          </span>
        )}
        {(company as { pending_changes?: unknown }).pending_changes != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2.5 py-1 text-xs font-semibold text-gold-700">
            Edits pending admin review
          </span>
        )}
      </div>
      <p className="mt-1 text-muted-foreground">
        Manage your packages, transport, guides and bookings — items go live once
        an admin approves them.
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
                {company.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={company.logo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Briefcase className="h-6 w-6" />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-forest">{user.name}</p>
                <span className="mt-1 inline-block rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-gold-700">
                  Tour Company · Partner
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
              <div className="mb-4 rounded-xl border border-forest-200 bg-forest-50/60 px-4 py-3 text-sm text-forest-600">This is exactly how customers see your company page.</div>
              <div className="overflow-hidden rounded-3xl border border-border/70 shadow-premium">
                <TourCompanyProfile company={company} packages={packages} transports={transports} guides={guides} />
              </div>
            </div>
          )}
          {tab === "crm" && <OwnerCrm user={user} />}
          {tab === "profile" && (
            <>
              <CompanyForm user={user} company={company} onSaved={refresh} />
              <AccountSecurity />
            </>
          )}
          {tab === "packages" && (
            <PackagesManager company={company} user={user} items={packages} onChange={refresh} />
          )}
          {tab === "transport" && (
            <TransportManager company={company} user={user} items={transports} onChange={refresh} />
          )}
          {tab === "guides" && (
            <GuidesManager company={company} user={user} items={guides} onChange={refresh} />
          )}
          {tab === "media" && <MediaTeamManager company={company} user={user} />}
          {tab === "activities" && (
            <ActivitiesManager user={user} ownerType="travel-company" businessName={company?.name ?? user.name} />
          )}
          {tab === "payments" && (
            <div className="space-y-8">
              <PaymentsManager table="tour_bookings" bookings={bookings} onChange={refresh} senderEmail={user.email} senderName={user.name} />
              <PaymentSettings tables={["tour_packages", "tour_companies"]} ownerEmail={user.email} />
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
          {tab === "reviews" && <ReviewsPanel company={company} />}
          {tab === "analytics" && (
            <AnalyticsPanel
              company={company}
              counts={{ packages: packages.length, transports: transports.length, guides: guides.length }}
              bookings={bookings}
            />
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
 * Company profile form
 * ============================================================ */

function CompanyForm({
  user,
  company,
  onSaved,
}: {
  user: User;
  company: TourCompanyRow | null;
  onSaved: () => void;
}) {
  const editing = !!company;
  const [f, setF] = React.useState({
    name: company?.name ?? "",
    owner_name: company?.owner_name ?? user.name,
    email: company?.email ?? user.email,
    phone: company?.phone ?? "",
    whatsapp: company?.whatsapp ?? "",
    reg_number: company?.reg_number ?? "",
    license_number: company?.license_number ?? "",
    logo: company?.logo ?? "",
    cover_image: company?.cover_image ?? "",
    gallery: company?.gallery ?? [],
    office_address: company?.office_address ?? "",
    location: company?.location ?? "Gilgit",
    service_areas: joinList(company?.service_areas),
    destinations: joinList(company?.destinations),
    description: company?.description ?? "",
    experience_years: company?.experience_years ? String(company.experience_years) : "",
    languages: joinList(company?.languages),
    emergency_contact: company?.emergency_contact ?? "",
    opening_hours: company?.opening_hours ?? "",
    social_links: joinList(company?.social_links),
    website: company?.website ?? "",
    license_doc: company?.license_doc ?? "",
    owner_cnic: company?.owner_cnic ?? "",
    owner_cnic_doc: company?.owner_cnic_doc ?? "",
    ownership_doc: company?.ownership_doc ?? "",
    terms: company?.terms ?? "",
    cancellation_policy: company?.cancellation_policy ?? "",
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saved, setSaved] = React.useState(false);
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!f.name.trim()) {
      setError("Please enter your company name.");
      return;
    }
    setSaving(true);
    const payload = {
      name: f.name.trim(),
      owner_name: f.owner_name.trim() || null,
      email: f.email.trim() || null,
      phone: f.phone.trim() || null,
      whatsapp: f.whatsapp.trim() || null,
      reg_number: f.reg_number.trim() || null,
      license_number: f.license_number.trim() || null,
      logo: f.logo.trim() || null,
      cover_image: f.cover_image.trim() || null,
      gallery: f.gallery,
      office_address: f.office_address.trim() || null,
      location: f.location.trim() || null,
      service_areas: splitList(f.service_areas),
      destinations: splitList(f.destinations),
      description: f.description.trim() || null,
      experience_years: num(f.experience_years),
      languages: splitList(f.languages),
      emergency_contact: f.emergency_contact.trim() || null,
      opening_hours: f.opening_hours.trim() || null,
      social_links: splitList(f.social_links),
      website: f.website.trim() || null,
      license_doc: f.license_doc.trim() || null,
      owner_cnic: f.owner_cnic.trim() || null,
      owner_cnic_doc: f.owner_cnic_doc.trim() || null,
      ownership_doc: f.ownership_doc.trim() || null,
      terms: f.terms.trim() || null,
      cancellation_policy: f.cancellation_policy.trim() || null,
      owner_email: user.email,
    };
    const { error: dbError } = editing
      ? await updateCompany(company!.id, payload)
      : await createCompany(payload);
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
          {editing ? "Company profile" : "Create your tour company profile"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This profile powers your public page. It goes live once an admin
          approves it.
        </p>
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">{error}</div>
      )}
      {saved && (
        <div className="flex items-center gap-2 rounded-lg border border-forest-200 bg-forest-50 px-4 py-2.5 text-sm font-medium text-forest-600">
          <CheckCircle2 className="h-4 w-4" /> Saved
        </div>
      )}

      <SectionTitle>Company details</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name" required>
          <input value={f.name} onChange={(e) => set({ name: e.target.value })} className="auth-input" placeholder="e.g. Karakoram Travels & Tours" />
        </Field>
        <Field label="Owner / manager name">
          <input value={f.owner_name} onChange={(e) => set({ owner_name: e.target.value })} className="auth-input" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Email"><input value={f.email} onChange={(e) => set({ email: e.target.value })} className="auth-input" /></Field>
        <Field label="Phone"><input value={f.phone} onChange={(e) => set({ phone: e.target.value })} className="auth-input" placeholder="+92 3xx…" /></Field>
        <Field label="WhatsApp"><input value={f.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} className="auth-input" placeholder="+92 3xx…" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business registration number"><input value={f.reg_number} onChange={(e) => set({ reg_number: e.target.value })} className="auth-input" /></Field>
        <Field label="Tourism license number"><input value={f.license_number} onChange={(e) => set({ license_number: e.target.value })} className="auth-input" /></Field>
      </div>

      <SectionTitle>Branding</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-forest">Company logo</span>
          <ImageUpload value={f.logo} onChange={(url) => set({ logo: url })} />
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-forest">Cover image</span>
          <ImageUpload value={f.cover_image} onChange={(url) => set({ cover_image: url })} />
        </div>
      </div>
      <div>
        <span className="mb-1.5 block text-sm font-semibold text-forest">Gallery images</span>
        <MultiImageUpload value={f.gallery} onChange={(urls) => set({ gallery: urls })} />
      </div>

      <SectionTitle>About &amp; coverage</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Office address"><input value={f.office_address} onChange={(e) => set({ office_address: e.target.value })} className="auth-input" /></Field>
        <Field label="Base location"><input value={f.location} onChange={(e) => set({ location: e.target.value })} className="auth-input" placeholder="e.g. Gilgit" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Service areas (comma separated)"><input value={f.service_areas} onChange={(e) => set({ service_areas: e.target.value })} className="auth-input" placeholder="Skardu, Hunza, Gilgit" /></Field>
        <Field label="Main destinations covered (comma separated)"><input value={f.destinations} onChange={(e) => set({ destinations: e.target.value })} className="auth-input" placeholder="K2 Base Camp, Fairy Meadows" /></Field>
      </div>
      <Field label="Company description">
        <textarea rows={3} value={f.description} onChange={(e) => set({ description: e.target.value })} className="auth-input resize-none" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Years of experience"><input type="number" value={f.experience_years} onChange={(e) => set({ experience_years: e.target.value })} className="auth-input" /></Field>
        <Field label="Languages supported (comma separated)"><input value={f.languages} onChange={(e) => set({ languages: e.target.value })} className="auth-input" placeholder="English, Urdu, Balti" /></Field>
        <Field label="Opening hours"><input value={f.opening_hours} onChange={(e) => set({ opening_hours: e.target.value })} className="auth-input" placeholder="9 AM – 9 PM" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Emergency contact"><input value={f.emergency_contact} onChange={(e) => set({ emergency_contact: e.target.value })} className="auth-input" /></Field>
        <Field label="Website link"><input value={f.website} onChange={(e) => set({ website: e.target.value })} className="auth-input" placeholder="https://…" /></Field>
        <Field label="Social media links (comma separated)"><input value={f.social_links} onChange={(e) => set({ social_links: e.target.value })} className="auth-input" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Terms &amp; conditions"><textarea rows={2} value={f.terms} onChange={(e) => set({ terms: e.target.value })} className="auth-input resize-none" /></Field>
        <Field label="Cancellation policy"><textarea rows={2} value={f.cancellation_policy} onChange={(e) => set({ cancellation_policy: e.target.value })} className="auth-input resize-none" /></Field>
      </div>

      <SectionTitle>Verification documents</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Owner ID (CNIC) number"><input value={f.owner_cnic} onChange={(e) => set({ owner_cnic: e.target.value })} className="auth-input" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-forest">Tourism license</span>
          <ImageUpload value={f.license_doc} onChange={(url) => set({ license_doc: url })} />
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-forest">Owner ID photo</span>
          <ImageUpload value={f.owner_cnic_doc} onChange={(url) => set({ owner_cnic_doc: url })} />
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-forest">Registration proof</span>
          <ImageUpload value={f.ownership_doc} onChange={(url) => set({ ownership_doc: url })} />
        </div>
      </div>

      <Button type="submit" variant="gold" size="lg" className="rounded-lg" disabled={saving}>
        {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : editing ? "Save changes" : "Create company"}
      </Button>
    </form>
  );
}

/* ============================================================
 * Packages manager
 * ============================================================ */

function PackagesManager({
  company,
  user,
  items,
  onChange,
}: {
  company: TourCompanyRow;
  user: User;
  items: TourPackageRow[];
  onChange: () => void;
}) {
  const [editing, setEditing] = React.useState<TourPackageRow | null>(null);
  const [adding, setAdding] = React.useState(false);

  if (adding || editing) {
    return (
      <PackageForm
        company={company}
        user={user}
        pkg={editing}
        onDone={() => {
          setAdding(false);
          setEditing(null);
          onChange();
        }}
        onCancel={() => {
          setAdding(false);
          setEditing(null);
        }}
      />
    );
  }

  return (
    <ManagerShell
      title="Manage Tour Packages"
      subtitle="Add the tour packages you offer. They appear on your profile and the customer Tour Packages page once approved."
      onAdd={() => setAdding(true)}
      addLabel="Add package"
      empty={items.length === 0}
      emptyText="No packages yet."
    >
      {items.map((p) => (
        <ItemRow
          key={p.id}
          image={p.image}
          title={p.title}
          subtitle={`${p.destination ?? ""} · ${p.duration ?? ""}`}
          price={`${formatPrice(p.price_per_person)} / person`}
          status={p.status}
          onEdit={() => setEditing(p)}
          onDelete={async () => {
            await deletePackage(p.id);
            onChange();
          }}
        />
      ))}
    </ManagerShell>
  );
}

function PackageForm({
  company,
  user,
  pkg,
  onDone,
  onCancel,
}: {
  company: TourCompanyRow;
  user: User;
  pkg: TourPackageRow | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const editing = !!pkg;
  const [f, setF] = React.useState({
    title: pkg?.title ?? "",
    destination: pkg?.destination ?? "",
    duration: pkg?.duration ?? "",
    package_type: pkg?.package_type ?? "Group",
    price_per_person: pkg?.price_per_person ? String(pkg.price_per_person) : "",
    group_price: pkg?.group_price ? String(pkg.group_price) : "",
    min_persons: pkg?.min_persons ? String(pkg.min_persons) : "",
    max_persons: pkg?.max_persons ? String(pkg.max_persons) : "",
    start_location: pkg?.start_location ?? "",
    end_location: pkg?.end_location ?? "",
    included: joinList(pkg?.included),
    excluded: joinList(pkg?.excluded),
    itinerary: pkg?.itinerary ?? "",
    accommodation_included: pkg?.accommodation_included ?? false,
    transport_included: pkg?.transport_included ?? false,
    guide_included: pkg?.guide_included ?? false,
    meals_included: pkg?.meals_included ?? false,
    image: pkg?.image ?? "",
    images: pkg?.images ?? [],
    available_dates: joinList(pkg?.available_dates),
    difficulty_level: pkg?.difficulty_level ?? "Moderate",
    cancellation_policy: pkg?.cancellation_policy ?? "",
    terms: pkg?.terms ?? "",
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!f.title.trim() || !Number(f.price_per_person)) {
      setError("Please enter a title and a valid price per person.");
      return;
    }
    setSaving(true);
    const payload = {
      company_id: company.id,
      company_name: company.name,
      title: f.title.trim(),
      destination: f.destination.trim() || null,
      location: f.destination.trim() || company.location,
      duration: f.duration.trim() || null,
      package_type: f.package_type,
      price_per_person: Number(f.price_per_person),
      group_price: num(f.group_price),
      min_persons: num(f.min_persons),
      max_persons: num(f.max_persons),
      start_location: f.start_location.trim() || null,
      end_location: f.end_location.trim() || null,
      included: splitList(f.included),
      excluded: splitList(f.excluded),
      itinerary: f.itinerary.trim() || null,
      accommodation_included: f.accommodation_included,
      transport_included: f.transport_included,
      guide_included: f.guide_included,
      meals_included: f.meals_included,
      image:
        f.image.trim() ||
        `https://picsum.photos/seed/tour-${Math.floor(Math.random() * 90) + 10}/900/600`,
      images: f.images,
      available_dates: splitList(f.available_dates),
      difficulty_level: f.difficulty_level,
      cancellation_policy: f.cancellation_policy.trim() || null,
      terms: f.terms.trim() || null,
      owner_email: user.email,
    };
    const { error: dbError } = editing
      ? await updatePackage(pkg!.id, payload)
      : await createPackage(payload);
    setSaving(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    onDone();
  };

  return (
    <form onSubmit={save} className="space-y-5 rounded-3xl border border-border/70 bg-card p-6 shadow-premium sm:p-8">
      <FormHeader title={editing ? "Edit package" : "Add tour package"} onCancel={onCancel} />
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Package title" required><input value={f.title} onChange={(e) => set({ title: e.target.value })} className="auth-input" placeholder="e.g. K2 Base Camp Trek" /></Field>
        <Field label="Destination"><input value={f.destination} onChange={(e) => set({ destination: e.target.value })} className="auth-input" placeholder="Skardu" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Duration"><input value={f.duration} onChange={(e) => set({ duration: e.target.value })} className="auth-input" placeholder="7 days / 6 nights" /></Field>
        <Field label="Package type">
          <select value={f.package_type} onChange={(e) => set({ package_type: e.target.value })} className="auth-input">
            {PACKAGE_TYPES.map((t) => <option key={t} value={t}>{t} Tour</option>)}
          </select>
        </Field>
        <Field label="Difficulty level">
          <select value={f.difficulty_level} onChange={(e) => set({ difficulty_level: e.target.value })} className="auth-input">
            {["Easy", "Moderate", "Challenging", "Expert"].map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Price / person (PKR)" required><input type="number" value={f.price_per_person} onChange={(e) => set({ price_per_person: e.target.value })} className="auth-input" /></Field>
        <Field label="Group price"><input type="number" value={f.group_price} onChange={(e) => set({ group_price: e.target.value })} className="auth-input" /></Field>
        <Field label="Min persons"><input type="number" value={f.min_persons} onChange={(e) => set({ min_persons: e.target.value })} className="auth-input" /></Field>
        <Field label="Max persons"><input type="number" value={f.max_persons} onChange={(e) => set({ max_persons: e.target.value })} className="auth-input" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start location"><input value={f.start_location} onChange={(e) => set({ start_location: e.target.value })} className="auth-input" /></Field>
        <Field label="End location"><input value={f.end_location} onChange={(e) => set({ end_location: e.target.value })} className="auth-input" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Included services (comma separated)"><textarea rows={2} value={f.included} onChange={(e) => set({ included: e.target.value })} className="auth-input resize-none" /></Field>
        <Field label="Excluded services (comma separated)"><textarea rows={2} value={f.excluded} onChange={(e) => set({ excluded: e.target.value })} className="auth-input resize-none" /></Field>
      </div>
      <Field label="Itinerary (day by day)"><textarea rows={4} value={f.itinerary} onChange={(e) => set({ itinerary: e.target.value })} className="auth-input resize-none" placeholder={"Day 1: …\nDay 2: …"} /></Field>
      <div className="flex flex-wrap gap-4">
        {([["accommodation_included", "Accommodation"], ["transport_included", "Transport"], ["guide_included", "Guide"], ["meals_included", "Meals"]] as const).map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-sm font-medium text-forest">
            <input type="checkbox" checked={f[k]} onChange={(e) => set({ [k]: e.target.checked } as Partial<typeof f>)} className="h-4 w-4 accent-forest-600" />
            {label} included
          </label>
        ))}
      </div>
      <Field label="Available dates (comma separated)"><input value={f.available_dates} onChange={(e) => set({ available_dates: e.target.value })} className="auth-input" placeholder="2026-07-01, 2026-08-15" /></Field>
      <div>
        <span className="mb-1.5 block text-sm font-semibold text-forest">Cover image</span>
        <ImageUpload value={f.image} onChange={(url) => set({ image: url })} />
      </div>
      <div>
        <span className="mb-1.5 block text-sm font-semibold text-forest">Package images</span>
        <MultiImageUpload value={f.images} onChange={(urls) => set({ images: urls })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cancellation policy"><textarea rows={2} value={f.cancellation_policy} onChange={(e) => set({ cancellation_policy: e.target.value })} className="auth-input resize-none" /></Field>
        <Field label="Terms &amp; conditions"><textarea rows={2} value={f.terms} onChange={(e) => set({ terms: e.target.value })} className="auth-input resize-none" /></Field>
      </div>
      <SaveButtons saving={saving} editing={editing} onCancel={onCancel} />
    </form>
  );
}

/* ============================================================
 * Transport manager
 * ============================================================ */

function TransportManager({
  company,
  user,
  items,
  onChange,
}: {
  company: TourCompanyRow;
  user: User;
  items: TransportRow[];
  onChange: () => void;
}) {
  const [editing, setEditing] = React.useState<TransportRow | null>(null);
  const [adding, setAdding] = React.useState(false);

  if (adding || editing) {
    return (
      <TransportForm
        company={company}
        user={user}
        item={editing}
        onDone={() => { setAdding(false); setEditing(null); onChange(); }}
        onCancel={() => { setAdding(false); setEditing(null); }}
      />
    );
  }
  return (
    <ManagerShell
      title="Manage Transport"
      subtitle="Add the vehicles you offer. They appear on your profile and the customer Transport / Rental page once approved."
      onAdd={() => setAdding(true)}
      addLabel="Add vehicle"
      empty={items.length === 0}
      emptyText="No vehicles yet."
    >
      {items.map((t) => (
        <ItemRow
          key={t.id}
          image={t.image}
          title={t.name}
          subtitle={`${t.vehicle_type ?? ""} · ${t.seats ?? "—"} seats`}
          price={`${formatPrice(t.price_per_day)} / day`}
          status={t.status}
          onEdit={() => setEditing(t)}
          onDelete={async () => { await deleteTransport(t.id); onChange(); }}
        />
      ))}
    </ManagerShell>
  );
}

function TransportForm({
  company,
  user,
  item,
  onDone,
  onCancel,
}: {
  company: TourCompanyRow;
  user: User;
  item: TransportRow | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const editing = !!item;
  const [f, setF] = React.useState({
    name: item?.name ?? "",
    vehicle_type: item?.vehicle_type ?? "Jeep",
    model_year: item?.model_year ?? "",
    vehicle_number: item?.vehicle_number ?? "",
    seats: item?.seats ? String(item.seats) : "",
    driver_included: item?.driver_included ?? true,
    driver_name: item?.driver_name ?? "",
    driver_contact: item?.driver_contact ?? "",
    price_per_day: item?.price_per_day ? String(item.price_per_day) : "",
    price_per_trip: item?.price_per_trip ? String(item.price_per_trip) : "",
    areas: joinList(item?.areas),
    image: item?.image ?? "",
    images: item?.images ?? [],
    ac: item?.ac ?? false,
    fuel_type: item?.fuel_type ?? "Petrol",
    availability_status: item?.availability_status ?? "available",
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!f.name.trim() || !Number(f.price_per_day)) {
      setError("Please enter a vehicle name and a valid price per day.");
      return;
    }
    setSaving(true);
    const payload = {
      company_id: company.id,
      company_name: company.name,
      name: f.name.trim(),
      vehicle_type: f.vehicle_type,
      model_year: f.model_year.trim() || null,
      vehicle_number: f.vehicle_number.trim() || null,
      seats: num(f.seats),
      driver_included: f.driver_included,
      driver_name: f.driver_name.trim() || null,
      driver_contact: f.driver_contact.trim() || null,
      price_per_day: Number(f.price_per_day),
      price_per_trip: num(f.price_per_trip),
      areas: splitList(f.areas),
      location: splitList(f.areas)[0] ?? company.location,
      image:
        f.image.trim() ||
        `https://picsum.photos/seed/vehicle-${Math.floor(Math.random() * 90) + 10}/900/600`,
      images: f.images,
      ac: f.ac,
      fuel_type: f.fuel_type.trim() || null,
      availability_status: f.availability_status,
      owner_email: user.email,
    };
    const { error: dbError } = editing
      ? await updateTransport(item!.id, payload)
      : await createTransport(payload);
    setSaving(false);
    if (dbError) { setError(dbError.message); return; }
    onDone();
  };

  return (
    <form onSubmit={save} className="space-y-5 rounded-3xl border border-border/70 bg-card p-6 shadow-premium sm:p-8">
      <FormHeader title={editing ? "Edit vehicle" : "Add vehicle"} onCancel={onCancel} />
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vehicle name" required><input value={f.name} onChange={(e) => set({ name: e.target.value })} className="auth-input" placeholder="e.g. Toyota Land Cruiser" /></Field>
        <Field label="Vehicle type">
          <select value={f.vehicle_type} onChange={(e) => set({ vehicle_type: e.target.value })} className="auth-input">
            {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Model year"><input value={f.model_year} onChange={(e) => set({ model_year: e.target.value })} className="auth-input" placeholder="2022" /></Field>
        <Field label="Vehicle number"><input value={f.vehicle_number} onChange={(e) => set({ vehicle_number: e.target.value })} className="auth-input" /></Field>
        <Field label="Seating capacity"><input type="number" value={f.seats} onChange={(e) => set({ seats: e.target.value })} className="auth-input" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Price / day (PKR)" required><input type="number" value={f.price_per_day} onChange={(e) => set({ price_per_day: e.target.value })} className="auth-input" /></Field>
        <Field label="Price / trip"><input type="number" value={f.price_per_trip} onChange={(e) => set({ price_per_trip: e.target.value })} className="auth-input" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Fuel type">
          <select value={f.fuel_type} onChange={(e) => set({ fuel_type: e.target.value })} className="auth-input">
            {["Petrol", "Diesel", "Hybrid", "Electric"].map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Availability">
          <select value={f.availability_status} onChange={(e) => set({ availability_status: e.target.value })} className="auth-input">
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </Field>
        <label className="flex items-end gap-2 pb-3 text-sm font-medium text-forest">
          <input type="checkbox" checked={f.ac} onChange={(e) => set({ ac: e.target.checked })} className="h-4 w-4 accent-forest-600" /> Air-conditioned
        </label>
      </div>
      <div className="rounded-xl border border-border bg-forest-50/40 p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-forest">
          <input type="checkbox" checked={f.driver_included} onChange={(e) => set({ driver_included: e.target.checked })} className="h-4 w-4 accent-forest-600" /> Driver included
        </label>
        {f.driver_included && (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label="Driver name"><input value={f.driver_name} onChange={(e) => set({ driver_name: e.target.value })} className="auth-input" /></Field>
            <Field label="Driver contact"><input value={f.driver_contact} onChange={(e) => set({ driver_contact: e.target.value })} className="auth-input" /></Field>
          </div>
        )}
      </div>
      <Field label="Available areas (comma separated)"><input value={f.areas} onChange={(e) => set({ areas: e.target.value })} className="auth-input" placeholder="Skardu, Hunza, Deosai" /></Field>
      <div>
        <span className="mb-1.5 block text-sm font-semibold text-forest">Cover image</span>
        <ImageUpload value={f.image} onChange={(url) => set({ image: url })} />
      </div>
      <div>
        <span className="mb-1.5 block text-sm font-semibold text-forest">Vehicle images</span>
        <MultiImageUpload value={f.images} onChange={(urls) => set({ images: urls })} />
      </div>
      <SaveButtons saving={saving} editing={editing} onCancel={onCancel} />
    </form>
  );
}

/* ============================================================
 * Guides manager
 * ============================================================ */

function GuidesManager({
  company,
  user,
  items,
  onChange,
}: {
  company: TourCompanyRow;
  user: User;
  items: TourGuideRow[];
  onChange: () => void;
}) {
  const [editing, setEditing] = React.useState<TourGuideRow | null>(null);
  const [adding, setAdding] = React.useState(false);

  if (adding || editing) {
    return (
      <GuideForm
        company={company}
        user={user}
        item={editing}
        onDone={() => { setAdding(false); setEditing(null); onChange(); }}
        onCancel={() => { setAdding(false); setEditing(null); }}
      />
    );
  }
  return (
    <ManagerShell
      title="Manage Tour Guides"
      subtitle="Add your guides. They appear on your profile and the customer Tour Guides page once approved."
      onAdd={() => setAdding(true)}
      addLabel="Add guide"
      empty={items.length === 0}
      emptyText="No guides yet."
    >
      {items.map((g) => (
        <ItemRow
          key={g.id}
          image={g.image}
          title={g.name}
          subtitle={`${g.specialization ?? ""} Guide · ${g.experience_years ?? "—"} yrs`}
          price={`${formatPrice(g.price_per_day)} / day`}
          status={g.status}
          onEdit={() => setEditing(g)}
          onDelete={async () => { await deleteGuide(g.id); onChange(); }}
        />
      ))}
    </ManagerShell>
  );
}

function GuideForm({
  company,
  user,
  item,
  onDone,
  onCancel,
}: {
  company: TourCompanyRow;
  user: User;
  item: TourGuideRow | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const editing = !!item;
  const [f, setF] = React.useState({
    name: item?.name ?? "",
    image: item?.image ?? "",
    phone: item?.phone ?? "",
    languages: joinList(item?.languages),
    experience_years: item?.experience_years ? String(item.experience_years) : "",
    specialization: item?.specialization ?? "Trekking",
    areas: joinList(item?.areas),
    price_per_day: item?.price_per_day ? String(item.price_per_day) : "",
    availability_status: item?.availability_status ?? "available",
    bio: item?.bio ?? "",
    certifications: joinList(item?.certifications),
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!f.name.trim() || !Number(f.price_per_day)) {
      setError("Please enter the guide's name and a valid price per day.");
      return;
    }
    setSaving(true);
    const payload = {
      company_id: company.id,
      company_name: company.name,
      name: f.name.trim(),
      image:
        f.image.trim() ||
        `https://i.pravatar.cc/300?u=${encodeURIComponent(f.name.trim())}`,
      phone: f.phone.trim() || null,
      languages: splitList(f.languages),
      experience_years: num(f.experience_years),
      specialization: f.specialization,
      areas: splitList(f.areas),
      location: splitList(f.areas)[0] ?? company.location,
      price_per_day: Number(f.price_per_day),
      availability_status: f.availability_status,
      bio: f.bio.trim() || null,
      certifications: splitList(f.certifications),
      owner_email: user.email,
    };
    const { error: dbError } = editing
      ? await updateGuide(item!.id, payload)
      : await createGuide(payload);
    setSaving(false);
    if (dbError) { setError(dbError.message); return; }
    onDone();
  };

  return (
    <form onSubmit={save} className="space-y-5 rounded-3xl border border-border/70 bg-card p-6 shadow-premium sm:p-8">
      <FormHeader title={editing ? "Edit guide" : "Add tour guide"} onCancel={onCancel} />
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="flex items-center gap-4">
        <AvatarUpload value={f.image} onChange={(url) => set({ image: url })} />
        <div className="flex-1">
          <Field label="Guide name" required><input value={f.name} onChange={(e) => set({ name: e.target.value })} className="auth-input" /></Field>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Phone"><input value={f.phone} onChange={(e) => set({ phone: e.target.value })} className="auth-input" /></Field>
        <Field label="Experience (years)"><input type="number" value={f.experience_years} onChange={(e) => set({ experience_years: e.target.value })} className="auth-input" /></Field>
        <Field label="Price / day (PKR)" required><input type="number" value={f.price_per_day} onChange={(e) => set({ price_per_day: e.target.value })} className="auth-input" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Specialization">
          <select value={f.specialization} onChange={(e) => set({ specialization: e.target.value })} className="auth-input">
            {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s} Guide</option>)}
          </select>
        </Field>
        <Field label="Availability">
          <select value={f.availability_status} onChange={(e) => set({ availability_status: e.target.value })} className="auth-input">
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Languages (comma separated)"><input value={f.languages} onChange={(e) => set({ languages: e.target.value })} className="auth-input" placeholder="English, Urdu, Balti" /></Field>
        <Field label="Areas covered (comma separated)"><input value={f.areas} onChange={(e) => set({ areas: e.target.value })} className="auth-input" placeholder="Skardu, Hunza" /></Field>
      </div>
      <Field label="Certifications (comma separated)"><input value={f.certifications} onChange={(e) => set({ certifications: e.target.value })} className="auth-input" placeholder="Licensed Mountain Guide, First Aid" /></Field>
      <Field label="Bio"><textarea rows={3} value={f.bio} onChange={(e) => set({ bio: e.target.value })} className="auth-input resize-none" /></Field>
      <SaveButtons saving={saving} editing={editing} onCancel={onCancel} />
    </form>
  );
}

/* ============================================================
 * Bookings / Reviews / Analytics
 * ============================================================ */

function BookingsPanel({
  bookings,
  onAct,
  onChat,
  unread,
}: {
  bookings: TourBookingRow[];
  onAct: (id: string, status: "accepted" | "rejected") => void;
  onChat: (b: TourBookingRow) => void;
  unread: Set<string>;
}) {
  if (bookings.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-muted/40 py-16 text-center">
        <CalendarCheck className="mx-auto h-10 w-10 text-forest-600" />
        <p className="mt-2 font-display text-lg font-semibold text-forest">No booking requests yet</p>
        <p className="text-sm text-muted-foreground">Package, transport and guide bookings appear here.</p>
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
                {tourBookingRef(b.id)} · {b.item_type}
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
            <KV k="From (city)" v={b.customer_city ?? "—"} />
            <KV k="Phone" v={b.customer_phone ?? "—"} />
            <KV k="Email" v={b.customer_email} />
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

function ReviewsPanel({ company }: { company: TourCompanyRow }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-premium">
      <div className="flex items-center gap-3">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-forest text-gold">
          <Star className="h-6 w-6 fill-gold" />
        </span>
        <div>
          <p className="font-display text-3xl font-extrabold text-forest">
            {Number(company.rating || 0).toFixed(1)}
          </p>
          <p className="text-sm text-muted-foreground">
            {company.reviews} review{company.reviews === 1 ? "" : "s"} across your listings
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Customer reviews left on your packages, vehicles and guides are reflected
        in your overall rating and shown on your public company profile.
      </p>
    </div>
  );
}

function AnalyticsPanel({
  company,
  counts,
  bookings,
}: {
  company: TourCompanyRow;
  counts: { packages: number; transports: number; guides: number };
  bookings: TourBookingRow[];
}) {
  const month = new Date().toISOString().slice(0, 7);
  const monthlyRevenue = bookings
    .filter((b) => b.status === "accepted" && b.created_at?.slice(0, 7) === month)
    .reduce((s, b) => s + (b.total_price || 0), 0);
  const accepted = bookings.filter((b) => b.status === "accepted").length;
  const pending = bookings.filter((b) => b.status === "pending").length;
  const totalGuests = bookings.filter((b) => b.status === "accepted").reduce((s, b) => s + (b.guests || 0), 0);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Stat icon={Map} label="Packages" value={counts.packages} />
      <Stat icon={Bus} label="Vehicles" value={counts.transports} />
      <Stat icon={UserRound} label="Guides" value={counts.guides} />
      <Stat icon={CalendarCheck} label="Total bookings" value={bookings.length} accent />
      <Stat icon={CheckCircle2} label="Confirmed" value={accepted} />
      <Stat icon={Database} label="Pending" value={pending} />
      <Stat icon={Users} label="Guests served" value={totalGuests} />
      <Stat icon={Wallet} label="Revenue (month)" value={formatPrice(monthlyRevenue)} />
      <div className="sm:col-span-2 lg:col-span-4">
        <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-forest-600" /> Overall rating
          </p>
          <p className="font-display text-2xl font-bold text-forest">
            {Number(company.rating || 0).toFixed(1)} · {company.reviews} reviews
          </p>
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

function ItemRow({
  image,
  title,
  subtitle,
  price,
  status,
  onEdit,
  onDelete,
}: {
  image: string | null;
  title: string;
  subtitle: string;
  price: string;
  status: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-card p-4 shadow-premium sm:flex-row sm:items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image ?? ""} alt={title} className="h-28 w-full shrink-0 rounded-xl object-cover sm:h-20 sm:w-28" />
      <div className="flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-forest">{title}</h3>
          <StatusBadge status={status} />
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        <div className="mt-2 flex items-center justify-between">
          <p className="font-display font-bold text-forest">{price}</p>
          <div className="flex gap-2">
            <button onClick={onEdit} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-forest hover:bg-muted"><Pencil className="h-3.5 w-3.5" /> Edit</button>
            <button onClick={onDelete} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: typeof Map; label: string; value: string | number; accent?: boolean }) {
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
