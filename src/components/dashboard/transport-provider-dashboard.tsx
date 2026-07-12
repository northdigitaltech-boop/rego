"use client";

import * as React from "react";
import {
  LayoutDashboard,
  Briefcase,
  Bus,
  Car,
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
  CalendarX,
  Database,
  Wallet,
  Users,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ImageUpload,
  MultiImageUpload,
} from "@/components/ui/image-upload";
import { ChatModal } from "@/components/chat/chat-modal";
import { PaymentSettings } from "@/components/payments/payment-settings";
import { PaymentsManager } from "@/components/payments/payments-manager";
import { MessagesInbox } from "@/components/chat/messages-inbox";
import { ContactAdminButton } from "@/components/chat/contact-admin-button";
import { AccountSecurity } from "@/components/account/account-security";
import { OwnerCrm } from "@/components/crm/owner-crm";
import { useUnread } from "@/lib/use-unread";
import { useAuth, type User } from "@/components/auth/auth-context";
import { type BookingRow } from "@/lib/bookings";
import {
  getProviderByOwner,
  createProvider,
  updateProvider,
  getServicesByProvider,
  createService,
  updateService,
  deleteService,
  getRentalsByProvider,
  createRental,
  updateRental,
  deleteRental,
  type TransportProviderRow,
  type TransportServiceRow,
  type RentalVehicleRow,
} from "@/lib/transport";
import {
  getTransportBookingsByOwner,
  setTransportBookingStatus,
  transportBookingRef,
  getBlockedDates,
  blockDates,
  unblockDate,
  enumerateDates,
  type TransportBookingRow,
  type AvailabilityRow,
} from "@/lib/transport-bookings";
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

const DEFAULT_SERVICE_RULES = `• Valid CNIC / Passport required at pickup.
• Booking is confirmed only after the provider accepts the request.
• Fuel, toll and parking charges are included unless stated otherwise.
• For multi-day trips, driver food and accommodation are arranged by the customer.
• Cancellations within 24 hours of the trip may incur a charge.
• Please be on time at the pickup point; waiting charges may apply.`;

const DEFAULT_RENTAL_TERMS = `• Renter must hold a valid driving license and CNIC / Passport.
• A refundable security deposit is required at pickup.
• Fuel policy: return the vehicle with the same fuel level as pickup.
• Mileage limit applies; extra mileage is charged per kilometre.
• Any traffic fines or challans during the rental period are the renter's responsibility.
• Late returns are charged at the hourly rate.`;

const DEFAULT_DAMAGE_POLICY = `The renter is responsible for any damage during the rental period. Minor damages are deducted from the security deposit; major damages are assessed and billed separately. The vehicle is inspected at pickup and return.`;

const SERVICE_VEHICLE_TYPES = ["Jeep", "Car", "Van", "Coaster", "Bus", "Bike"];
const RENTAL_VEHICLE_TYPES = ["Car", "Jeep", "Bike", "Van"];
const RENTAL_TYPES = ["Self Drive", "With Driver Optional", "Private Rental"];
const FUEL_TYPES = ["Petrol", "Diesel", "Hybrid", "Electric"];
const BUSINESS_TYPES = ["Individual", "Company", "Tour Company"];

type Tab =
  | "profile"
  | "services"
  | "rentals"
  | "bookings"
  | "payments"
  | "messages"
  | "reviews"
  | "analytics"
  | "crm";

const nav: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "profile", label: "Provider Profile", icon: Briefcase },
  { id: "services", label: "Transport Services", icon: Bus },
  { id: "rentals", label: "Rental Vehicles", icon: Car },
  { id: "bookings", label: "Bookings", icon: CalendarCheck },
  { id: "payments", label: "Payments", icon: Wallet },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "reviews", label: "Reviews", icon: Star },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "crm", label: "CRM & Insights", icon: BarChart3 },
];

export function TransportProviderDashboard({
  user,
  onSignOut,
}: {
  user: User;
  onSignOut: () => void;
}) {
  const [tab, setTab] = React.useState<Tab>("profile");
  const [provider, setProvider] = React.useState<TransportProviderRow | null>(null);
  const [services, setServices] = React.useState<TransportServiceRow[]>([]);
  const [rentals, setRentals] = React.useState<RentalVehicleRow[]>([]);
  const [bookings, setBookings] = React.useState<TransportBookingRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [chatBooking, setChatBooking] = React.useState<BookingRow | null>(null);

  const refresh = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const p = await getProviderByOwner(user.email);
    setProvider(p);
    if (p) {
      const [s, r, b] = await Promise.all([
        getServicesByProvider(p.id),
        getRentalsByProvider(p.id),
        getTransportBookingsByOwner(user.email),
      ]);
      setServices(s);
      setRentals(r);
      setBookings(b);
    }
    if (!silent) setLoading(false);
  }, [user.email]);

  React.useEffect(() => {
    refresh();
    const t = setInterval(() => { if (document.visibilityState === "visible") refresh(true); }, 45000);
    return () => clearInterval(t);
  }, [refresh]);

  const toRow = (b: TransportBookingRow): BookingRow =>
    ({
      ...b,
      hotel_id: b.provider_id,
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
  const openChat = (b: TransportBookingRow) => openChatRow(toRow(b));

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
    await setTransportBookingStatus(id, status);
    if (b) {
      sendEmail(
        b.customer_email,
        status === "accepted"
          ? "Your Rego booking is confirmed"
          : "Rego booking update",
        bookingStatusEmail({
          name: b.customer_name ?? "Guest",
          hotel: b.item_title,
          ref: transportBookingRef(b.id),
          accepted: status === "accepted",
        })
      );
      await sendBookingStatusNotification({
        booking_id: b.id,
        owner_email: user.email,
        owner_name: provider?.name ?? user.name,
        ref: transportBookingRef(b.id),
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

  if (!provider) {
    return (
      <div className="container-px py-10">
        <h1 className="font-display text-3xl font-bold text-forest">
          Welcome, {user.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Register your transport business to start listing transport services
          and rental vehicles.
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
        <h1 className="font-display text-3xl font-bold text-forest">
          {provider.name}
        </h1>
        <StatusBadge status={provider.status} />
        {provider.verified && (
          <span className="inline-flex items-center gap-1 rounded-full bg-forest-600 px-2.5 py-1 text-xs font-semibold text-white">
            <CheckCircle2 className="h-3.5 w-3.5" /> Verified
          </span>
        )}
        {(provider as { pending_changes?: unknown }).pending_changes != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2.5 py-1 text-xs font-semibold text-gold-700">
            Edits pending admin review
          </span>
        )}
      </div>
      <p className="mt-1 text-muted-foreground">
        Manage your transport services, rental vehicles and bookings — listings
        go live once an admin approves them.
      </p>
      <div className="mt-3">
        <ContactAdminButton ownerEmail={user.email} ownerName={user.name} ownerAvatar={user.avatar} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside>
          <div className="sticky top-24 rounded-3xl border border-border/70 bg-card p-3 shadow-premium">
            <div className="flex items-center gap-3 border-b border-border p-3">
              <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-gradient-gold text-forest-900">
                {provider.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={provider.logo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Bus className="h-6 w-6" />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-forest">{user.name}</p>
                <span className="mt-1 inline-block rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-gold-700">
                  Transport · Partner
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
          {tab === "crm" && <OwnerCrm user={user} />}
          {tab === "profile" && (
            <>
              <ProviderForm user={user} provider={provider} onSaved={refresh} />
              <AccountSecurity />
            </>
          )}
          {tab === "services" && (
            <ServicesManager provider={provider} user={user} items={services} onChange={refresh} />
          )}
          {tab === "rentals" && (
            <RentalsManager provider={provider} user={user} items={rentals} onChange={refresh} />
          )}
          {tab === "payments" && (
            <div className="space-y-8">
              <PaymentsManager table="transport_bookings" bookings={bookings} onChange={refresh} senderEmail={user.email} senderName={user.name} />
              <PaymentSettings tables={["rental_vehicles", "transport_services", "transport_providers"]} ownerEmail={user.email} />
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
          {tab === "reviews" && <ReviewsPanel provider={provider} />}
          {tab === "analytics" && (
            <AnalyticsPanel
              provider={provider}
              services={services}
              rentals={rentals}
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
 * Provider registration form
 * ============================================================ */

function ProviderForm({
  user,
  provider,
  onSaved,
}: {
  user: User;
  provider: TransportProviderRow | null;
  onSaved: () => void;
}) {
  const editing = !!provider;
  const [f, setF] = React.useState({
    name: provider?.name ?? "",
    owner_name: provider?.owner_name ?? user.name,
    email: provider?.email ?? user.email,
    phone: provider?.phone ?? "",
    whatsapp: provider?.whatsapp ?? "",
    business_type: provider?.business_type ?? "Individual",
    reg_number: provider?.reg_number ?? "",
    license_number: provider?.license_number ?? "",
    logo: provider?.logo ?? "",
    cover_image: provider?.cover_image ?? "",
    address: provider?.address ?? "",
    location: provider?.location ?? "Gilgit",
    service_areas: joinList(provider?.service_areas),
    description: provider?.description ?? "",
    opening_hours: provider?.opening_hours ?? "",
    emergency_contact: provider?.emergency_contact ?? "",
    license_doc: provider?.license_doc ?? "",
    owner_cnic: provider?.owner_cnic ?? "",
    owner_cnic_doc: provider?.owner_cnic_doc ?? "",
    ownership_doc: provider?.ownership_doc ?? "",
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saved, setSaved] = React.useState(false);
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!f.name.trim()) {
      setError("Please enter your provider / company name.");
      return;
    }
    setSaving(true);
    const payload = {
      name: f.name.trim(),
      owner_name: f.owner_name.trim() || null,
      email: f.email.trim() || null,
      phone: f.phone.trim() || null,
      whatsapp: f.whatsapp.trim() || null,
      business_type: f.business_type,
      reg_number: f.reg_number.trim() || null,
      license_number: f.license_number.trim() || null,
      logo: f.logo.trim() || null,
      cover_image: f.cover_image.trim() || null,
      address: f.address.trim() || null,
      location: f.location.trim() || null,
      service_areas: splitList(f.service_areas),
      description: f.description.trim() || null,
      opening_hours: f.opening_hours.trim() || null,
      emergency_contact: f.emergency_contact.trim() || null,
      license_doc: f.license_doc.trim() || null,
      owner_cnic: f.owner_cnic.trim() || null,
      owner_cnic_doc: f.owner_cnic_doc.trim() || null,
      ownership_doc: f.ownership_doc.trim() || null,
      owner_email: user.email,
    };
    const { error: dbError } = editing
      ? await updateProvider(provider!.id, payload)
      : await createProvider(payload);
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
          {editing ? "Provider profile" : "Register your transport business"}
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

      <SectionTitle>Business details</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Provider / company name" required>
          <input value={f.name} onChange={(e) => set({ name: e.target.value })} className="auth-input" placeholder="e.g. Hunza Rides & Rentals" />
        </Field>
        <Field label="Owner name">
          <input value={f.owner_name} onChange={(e) => set({ owner_name: e.target.value })} className="auth-input" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Email"><input value={f.email} onChange={(e) => set({ email: e.target.value })} className="auth-input" /></Field>
        <Field label="Phone"><input value={f.phone} onChange={(e) => set({ phone: e.target.value })} className="auth-input" placeholder="+92 3xx…" /></Field>
        <Field label="WhatsApp"><input value={f.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} className="auth-input" placeholder="+92 3xx…" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Business type">
          <select value={f.business_type} onChange={(e) => set({ business_type: e.target.value })} className="auth-input">
            {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Business registration number"><input value={f.reg_number} onChange={(e) => set({ reg_number: e.target.value })} className="auth-input" /></Field>
        <Field label="License number"><input value={f.license_number} onChange={(e) => set({ license_number: e.target.value })} className="auth-input" /></Field>
      </div>

      <SectionTitle>Branding</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-forest">Profile image / logo</span>
          <ImageUpload value={f.logo} onChange={(url) => set({ logo: url })} />
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-forest">Cover image</span>
          <ImageUpload value={f.cover_image} onChange={(url) => set({ cover_image: url })} />
        </div>
      </div>

      <SectionTitle>About &amp; coverage</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Address"><input value={f.address} onChange={(e) => set({ address: e.target.value })} className="auth-input" /></Field>
        <Field label="Base location"><input value={f.location} onChange={(e) => set({ location: e.target.value })} className="auth-input" placeholder="e.g. Gilgit" /></Field>
      </div>
      <Field label="Service areas (comma separated)"><input value={f.service_areas} onChange={(e) => set({ service_areas: e.target.value })} className="auth-input" placeholder="Skardu, Hunza, Gilgit" /></Field>
      <Field label="Description"><textarea rows={3} value={f.description} onChange={(e) => set({ description: e.target.value })} className="auth-input resize-none" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Opening hours"><input value={f.opening_hours} onChange={(e) => set({ opening_hours: e.target.value })} className="auth-input" placeholder="9 AM – 9 PM" /></Field>
        <Field label="Emergency contact"><input value={f.emergency_contact} onChange={(e) => set({ emergency_contact: e.target.value })} className="auth-input" /></Field>
      </div>

      <SectionTitle>Verification documents</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Owner ID (CNIC) number"><input value={f.owner_cnic} onChange={(e) => set({ owner_cnic: e.target.value })} className="auth-input" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-forest">License / permit</span>
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
        {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : editing ? "Save changes" : "Register provider"}
      </Button>
    </form>
  );
}

/* ============================================================
 * Transport services manager
 * ============================================================ */

function ServicesManager({
  provider,
  user,
  items,
  onChange,
}: {
  provider: TransportProviderRow;
  user: User;
  items: TransportServiceRow[];
  onChange: () => void;
}) {
  const [editing, setEditing] = React.useState<TransportServiceRow | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [availItem, setAvailItem] = React.useState<TransportServiceRow | null>(null);

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
  if (availItem) {
    return (
      <AvailabilityEditor
        itemId={availItem.id}
        itemType="service"
        title={availItem.title}
        ownerEmail={user.email}
        onBack={() => setAvailItem(null)}
      />
    );
  }
  return (
    <ManagerShell
      title="Manage Transport Services"
      subtitle="Vehicle-with-driver and route-based services. They appear on the customer Transport & Rental page once approved."
      onAdd={() => setAdding(true)}
      addLabel="Add transport service"
      empty={items.length === 0}
      emptyText="No transport services yet."
    >
      {items.map((s) => (
        <ItemRow
          key={s.id}
          image={s.image}
          title={s.title}
          subtitle={`${s.vehicle_type ?? ""} · ${s.seats ?? "—"} seats${s.driver_included ? " · with driver" : ""}`}
          price={`${formatPrice(s.price_per_day || s.price_per_trip || 0)} / ${s.price_per_day ? "day" : "trip"}`}
          status={s.status}
          onEdit={() => setEditing(s)}
          onAvailability={() => setAvailItem(s)}
          onDelete={async () => { await deleteService(s.id); onChange(); }}
        />
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
  provider: TransportProviderRow;
  user: User;
  item: TransportServiceRow | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const editing = !!item;
  const [f, setF] = React.useState({
    title: item?.title ?? "",
    vehicle_type: item?.vehicle_type ?? "Jeep",
    vehicle_name: item?.vehicle_name ?? "",
    model_year: item?.model_year ?? "",
    vehicle_number: item?.vehicle_number ?? "",
    seats: item?.seats ? String(item.seats) : "",
    driver_included: item?.driver_included ?? true,
    driver_name: item?.driver_name ?? "",
    driver_contact: item?.driver_contact ?? "",
    route: item?.route ?? "",
    pickup_location: item?.pickup_location ?? "",
    dropoff_location: item?.dropoff_location ?? "",
    price_per_trip: item?.price_per_trip ? String(item.price_per_trip) : "",
    price_per_day: item?.price_per_day ? String(item.price_per_day) : "",
    price_per_km: item?.price_per_km ? String(item.price_per_km) : "",
    waiting_charges: item?.waiting_charges ? String(item.waiting_charges) : "",
    ac: item?.ac ?? false,
    fuel_type: item?.fuel_type ?? "Petrol",
    luggage: item?.luggage ?? "",
    available_from: item?.available_dates?.[0] ?? "",
    available_to: item?.available_dates?.[1] ?? "",
    image: item?.image ?? "",
    images: item?.images ?? [],
    description: item?.description ?? "",
    rules: item?.rules ?? DEFAULT_SERVICE_RULES,
    location: item?.location ?? provider.location ?? "",
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!f.title.trim() || (!Number(f.price_per_day) && !Number(f.price_per_trip))) {
      setError("Please enter a title and a price per day or per trip.");
      return;
    }
    setSaving(true);
    const payload = {
      provider_id: provider.id,
      provider_name: provider.name,
      listing_type: "service",
      title: f.title.trim(),
      vehicle_type: f.vehicle_type,
      vehicle_name: f.vehicle_name.trim() || null,
      model_year: f.model_year.trim() || null,
      vehicle_number: f.vehicle_number.trim() || null,
      seats: num(f.seats),
      driver_included: f.driver_included,
      driver_name: f.driver_name.trim() || null,
      driver_contact: f.driver_contact.trim() || null,
      route: f.route.trim() || null,
      pickup_location: f.pickup_location.trim() || null,
      dropoff_location: f.dropoff_location.trim() || null,
      price_per_trip: num(f.price_per_trip),
      price_per_day: Number(f.price_per_day) || 0,
      price_per_km: num(f.price_per_km),
      waiting_charges: num(f.waiting_charges),
      ac: f.ac,
      fuel_type: f.fuel_type.trim() || null,
      luggage: f.luggage.trim() || null,
      available_dates: [f.available_from, f.available_to].filter(Boolean),
      image:
        f.image.trim() ||
        `https://picsum.photos/seed/svc-${Math.floor(Math.random() * 90) + 10}/900/600`,
      images: f.images,
      description: f.description.trim() || null,
      rules: f.rules.trim() || null,
      location: f.location.trim() || provider.location,
      owner_email: user.email,
    };
    const { error: dbError } = editing
      ? await updateService(item!.id, payload)
      : await createService(payload);
    setSaving(false);
    if (dbError) { setError(dbError.message); return; }
    onDone();
  };

  return (
    <form onSubmit={save} className="space-y-5 rounded-3xl border border-border/70 bg-card p-6 shadow-premium sm:p-8">
      <FormHeader title={editing ? "Edit transport service" : "Add transport service"} onCancel={onCancel} />
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Service title" required><input value={f.title} onChange={(e) => set({ title: e.target.value })} className="auth-input" placeholder="e.g. Skardu Airport Transfer" /></Field>
        <Field label="Vehicle type">
          <select value={f.vehicle_type} onChange={(e) => set({ vehicle_type: e.target.value })} className="auth-input">
            {SERVICE_VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Vehicle name / model"><input value={f.vehicle_name} onChange={(e) => set({ vehicle_name: e.target.value })} className="auth-input" placeholder="Toyota Land Cruiser" /></Field>
        <Field label="Model year"><input value={f.model_year} onChange={(e) => set({ model_year: e.target.value })} className="auth-input" placeholder="2022" /></Field>
        <Field label="Vehicle number"><input value={f.vehicle_number} onChange={(e) => set({ vehicle_number: e.target.value })} className="auth-input" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Seating capacity"><input type="number" value={f.seats} onChange={(e) => set({ seats: e.target.value })} className="auth-input" /></Field>
        <Field label="Fuel type">
          <select value={f.fuel_type} onChange={(e) => set({ fuel_type: e.target.value })} className="auth-input">
            {FUEL_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
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
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Route / service area"><input value={f.route} onChange={(e) => set({ route: e.target.value })} className="auth-input" placeholder="Skardu – Khaplu" /></Field>
        <Field label="Pickup location"><input value={f.pickup_location} onChange={(e) => set({ pickup_location: e.target.value })} className="auth-input" /></Field>
        <Field label="Drop-off location"><input value={f.dropoff_location} onChange={(e) => set({ dropoff_location: e.target.value })} className="auth-input" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Price / day (PKR)"><input type="number" value={f.price_per_day} onChange={(e) => set({ price_per_day: e.target.value })} className="auth-input" /></Field>
        <Field label="Price / trip"><input type="number" value={f.price_per_trip} onChange={(e) => set({ price_per_trip: e.target.value })} className="auth-input" /></Field>
        <Field label="Price / km"><input type="number" value={f.price_per_km} onChange={(e) => set({ price_per_km: e.target.value })} className="auth-input" /></Field>
        <Field label="Waiting charges"><input type="number" value={f.waiting_charges} onChange={(e) => set({ waiting_charges: e.target.value })} className="auth-input" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Luggage capacity"><input value={f.luggage} onChange={(e) => set({ luggage: e.target.value })} className="auth-input" placeholder="e.g. 4 large bags" /></Field>
        <Field label="Base location"><input value={f.location} onChange={(e) => set({ location: e.target.value })} className="auth-input" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Available from"><input type="date" value={f.available_from} onChange={(e) => set({ available_from: e.target.value })} className="auth-input" /></Field>
        <Field label="Available to"><input type="date" value={f.available_to} min={f.available_from || undefined} onChange={(e) => set({ available_to: e.target.value })} className="auth-input" /></Field>
      </div>
      <div>
        <span className="mb-1.5 block text-sm font-semibold text-forest">Cover image</span>
        <ImageUpload value={f.image} onChange={(url) => set({ image: url })} />
      </div>
      <div>
        <span className="mb-1.5 block text-sm font-semibold text-forest">Service images</span>
        <MultiImageUpload value={f.images} onChange={(urls) => set({ images: urls })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Description"><textarea rows={3} value={f.description} onChange={(e) => set({ description: e.target.value })} className="auth-input resize-none" /></Field>
        <Field label="Rules &amp; conditions"><textarea rows={3} value={f.rules} onChange={(e) => set({ rules: e.target.value })} className="auth-input resize-none" /></Field>
      </div>
      <SaveButtons saving={saving} editing={editing} onCancel={onCancel} />
    </form>
  );
}

/* ============================================================
 * Rental vehicles manager
 * ============================================================ */

function RentalsManager({
  provider,
  user,
  items,
  onChange,
}: {
  provider: TransportProviderRow;
  user: User;
  items: RentalVehicleRow[];
  onChange: () => void;
}) {
  const [editing, setEditing] = React.useState<RentalVehicleRow | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [availItem, setAvailItem] = React.useState<RentalVehicleRow | null>(null);

  if (adding || editing) {
    return (
      <RentalForm
        provider={provider}
        user={user}
        item={editing}
        onDone={() => { setAdding(false); setEditing(null); onChange(); }}
        onCancel={() => { setAdding(false); setEditing(null); }}
      />
    );
  }
  if (availItem) {
    return (
      <AvailabilityEditor
        itemId={availItem.id}
        itemType="rental"
        title={availItem.title}
        ownerEmail={user.email}
        onBack={() => setAvailItem(null)}
      />
    );
  }
  return (
    <ManagerShell
      title="Manage Rental Vehicles"
      subtitle="Self-drive and private rental vehicles. They appear on the customer Transport & Rental page once approved."
      onAdd={() => setAdding(true)}
      addLabel="Add rental vehicle"
      empty={items.length === 0}
      emptyText="No rental vehicles yet."
    >
      {items.map((r) => (
        <ItemRow
          key={r.id}
          image={r.image}
          title={r.title}
          subtitle={`${r.vehicle_type ?? ""} · ${r.rental_type ?? ""} · ${r.seats ?? "—"} seats`}
          price={`${formatPrice(r.price_per_day)} / day`}
          status={r.status}
          onEdit={() => setEditing(r)}
          onAvailability={() => setAvailItem(r)}
          onDelete={async () => { await deleteRental(r.id); onChange(); }}
        />
      ))}
    </ManagerShell>
  );
}

function RentalForm({
  provider,
  user,
  item,
  onDone,
  onCancel,
}: {
  provider: TransportProviderRow;
  user: User;
  item: RentalVehicleRow | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const editing = !!item;
  const [f, setF] = React.useState({
    title: item?.title ?? "",
    vehicle_type: item?.vehicle_type ?? "Car",
    vehicle_name: item?.vehicle_name ?? "",
    model_year: item?.model_year ?? "",
    vehicle_number: item?.vehicle_number ?? "",
    seats: item?.seats ? String(item.seats) : "",
    rental_type: item?.rental_type ?? "Self Drive",
    price_per_hour: item?.price_per_hour ? String(item.price_per_hour) : "",
    price_per_day: item?.price_per_day ? String(item.price_per_day) : "",
    weekly_price: item?.weekly_price ? String(item.weekly_price) : "",
    monthly_price: item?.monthly_price ? String(item.monthly_price) : "",
    security_deposit: item?.security_deposit ? String(item.security_deposit) : "",
    required_documents: joinList(item?.required_documents) || "CNIC / Passport, Driving License",
    pickup_location: item?.pickup_location ?? "",
    return_location: item?.return_location ?? "",
    mileage_limit: item?.mileage_limit ?? "",
    extra_mileage_charges: item?.extra_mileage_charges ? String(item.extra_mileage_charges) : "",
    fuel_policy: item?.fuel_policy ?? "Full to Full",
    insurance_included: item?.insurance_included ?? false,
    damage_policy: item?.damage_policy ?? DEFAULT_DAMAGE_POLICY,
    available_from: item?.available_dates?.[0] ?? "",
    available_to: item?.available_dates?.[1] ?? "",
    image: item?.image ?? "",
    images: item?.images ?? [],
    description: item?.description ?? "",
    terms: item?.terms ?? DEFAULT_RENTAL_TERMS,
    location: item?.location ?? provider.location ?? "",
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!f.title.trim() || !Number(f.price_per_day)) {
      setError("Please enter a title and a valid price per day.");
      return;
    }
    setSaving(true);
    const payload = {
      provider_id: provider.id,
      provider_name: provider.name,
      listing_type: "rental",
      title: f.title.trim(),
      vehicle_type: f.vehicle_type,
      vehicle_name: f.vehicle_name.trim() || null,
      model_year: f.model_year.trim() || null,
      vehicle_number: f.vehicle_number.trim() || null,
      seats: num(f.seats),
      rental_type: f.rental_type,
      price_per_hour: num(f.price_per_hour),
      price_per_day: Number(f.price_per_day),
      weekly_price: num(f.weekly_price),
      monthly_price: num(f.monthly_price),
      security_deposit: num(f.security_deposit),
      required_documents: splitList(f.required_documents),
      pickup_location: f.pickup_location.trim() || null,
      return_location: f.return_location.trim() || null,
      mileage_limit: f.mileage_limit.trim() || null,
      extra_mileage_charges: num(f.extra_mileage_charges),
      fuel_policy: f.fuel_policy.trim() || null,
      insurance_included: f.insurance_included,
      damage_policy: f.damage_policy.trim() || null,
      available_dates: [f.available_from, f.available_to].filter(Boolean),
      image:
        f.image.trim() ||
        `https://picsum.photos/seed/rnt-${Math.floor(Math.random() * 90) + 10}/900/600`,
      images: f.images,
      description: f.description.trim() || null,
      terms: f.terms.trim() || null,
      location: f.location.trim() || provider.location,
      owner_email: user.email,
    };
    const { error: dbError } = editing
      ? await updateRental(item!.id, payload)
      : await createRental(payload);
    setSaving(false);
    if (dbError) { setError(dbError.message); return; }
    onDone();
  };

  return (
    <form onSubmit={save} className="space-y-5 rounded-3xl border border-border/70 bg-card p-6 shadow-premium sm:p-8">
      <FormHeader title={editing ? "Edit rental vehicle" : "Add rental vehicle"} onCancel={onCancel} />
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Rental vehicle title" required><input value={f.title} onChange={(e) => set({ title: e.target.value })} className="auth-input" placeholder="e.g. Toyota Corolla 2022 — Self Drive" /></Field>
        <Field label="Vehicle type">
          <select value={f.vehicle_type} onChange={(e) => set({ vehicle_type: e.target.value })} className="auth-input">
            {RENTAL_VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Vehicle name / model"><input value={f.vehicle_name} onChange={(e) => set({ vehicle_name: e.target.value })} className="auth-input" /></Field>
        <Field label="Model year"><input value={f.model_year} onChange={(e) => set({ model_year: e.target.value })} className="auth-input" /></Field>
        <Field label="Vehicle number"><input value={f.vehicle_number} onChange={(e) => set({ vehicle_number: e.target.value })} className="auth-input" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Seating capacity"><input type="number" value={f.seats} onChange={(e) => set({ seats: e.target.value })} className="auth-input" /></Field>
        <Field label="Rental type">
          <select value={f.rental_type} onChange={(e) => set({ rental_type: e.target.value })} className="auth-input">
            {RENTAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Fuel policy"><input value={f.fuel_policy} onChange={(e) => set({ fuel_policy: e.target.value })} className="auth-input" placeholder="Full to Full" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Price / hour"><input type="number" value={f.price_per_hour} onChange={(e) => set({ price_per_hour: e.target.value })} className="auth-input" /></Field>
        <Field label="Price / day (PKR)" required><input type="number" value={f.price_per_day} onChange={(e) => set({ price_per_day: e.target.value })} className="auth-input" /></Field>
        <Field label="Weekly price"><input type="number" value={f.weekly_price} onChange={(e) => set({ weekly_price: e.target.value })} className="auth-input" /></Field>
        <Field label="Monthly price"><input type="number" value={f.monthly_price} onChange={(e) => set({ monthly_price: e.target.value })} className="auth-input" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Security deposit"><input type="number" value={f.security_deposit} onChange={(e) => set({ security_deposit: e.target.value })} className="auth-input" /></Field>
        <Field label="Mileage limit"><input value={f.mileage_limit} onChange={(e) => set({ mileage_limit: e.target.value })} className="auth-input" placeholder="200 km/day" /></Field>
        <Field label="Extra mileage charges"><input type="number" value={f.extra_mileage_charges} onChange={(e) => set({ extra_mileage_charges: e.target.value })} className="auth-input" placeholder="per km" /></Field>
      </div>
      <Field label="Required documents (comma separated)"><input value={f.required_documents} onChange={(e) => set({ required_documents: e.target.value })} className="auth-input" placeholder="CNIC / Passport, Driving License, Security Deposit Receipt" /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Pickup location"><input value={f.pickup_location} onChange={(e) => set({ pickup_location: e.target.value })} className="auth-input" /></Field>
        <Field label="Return location"><input value={f.return_location} onChange={(e) => set({ return_location: e.target.value })} className="auth-input" /></Field>
        <label className="flex items-end gap-2 pb-3 text-sm font-medium text-forest">
          <input type="checkbox" checked={f.insurance_included} onChange={(e) => set({ insurance_included: e.target.checked })} className="h-4 w-4 accent-forest-600" /> Insurance included
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Available from"><input type="date" value={f.available_from} onChange={(e) => set({ available_from: e.target.value })} className="auth-input" /></Field>
        <Field label="Available to"><input type="date" value={f.available_to} min={f.available_from || undefined} onChange={(e) => set({ available_to: e.target.value })} className="auth-input" /></Field>
      </div>
      <div>
        <span className="mb-1.5 block text-sm font-semibold text-forest">Cover image</span>
        <ImageUpload value={f.image} onChange={(url) => set({ image: url })} />
      </div>
      <div>
        <span className="mb-1.5 block text-sm font-semibold text-forest">Vehicle images</span>
        <MultiImageUpload value={f.images} onChange={(urls) => set({ images: urls })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Damage policy"><textarea rows={3} value={f.damage_policy} onChange={(e) => set({ damage_policy: e.target.value })} className="auth-input resize-none" /></Field>
        <Field label="Description"><textarea rows={3} value={f.description} onChange={(e) => set({ description: e.target.value })} className="auth-input resize-none" /></Field>
      </div>
      <Field label="Rental terms &amp; conditions"><textarea rows={3} value={f.terms} onChange={(e) => set({ terms: e.target.value })} className="auth-input resize-none" /></Field>
      <SaveButtons saving={saving} editing={editing} onCancel={onCancel} />
    </form>
  );
}

/* ============================================================
 * Availability editor (provider blocks dates)
 * ============================================================ */

function AvailabilityEditor({
  itemId,
  itemType,
  title,
  ownerEmail,
  onBack,
}: {
  itemId: string;
  itemType: "service" | "rental";
  title: string;
  ownerEmail: string;
  onBack: () => void;
}) {
  const [blocks, setBlocks] = React.useState<AvailabilityRow[]>([]);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [reason, setReason] = React.useState("maintenance");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    setBlocks(await getBlockedDates(itemId));
  }, [itemId]);
  React.useEffect(() => { load(); }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!from) { setError("Pick a start date."); return; }
    setBusy(true);
    const dates = enumerateDates(from, to || from);
    const { error: dbError } = await blockDates({
      itemId, itemType, dates, reason, ownerEmail,
    });
    setBusy(false);
    if (dbError) { setError(dbError.message); return; }
    setFrom(""); setTo("");
    await load();
  };

  return (
    <div className="space-y-5 rounded-3xl border border-border/70 bg-card p-6 shadow-premium sm:p-8">
      <FormHeader title={`Availability · ${title}`} onCancel={onBack} />
      <p className="text-sm text-muted-foreground">
        Block dates when this vehicle is unavailable. Customers cannot book any
        blocked date — they will see “Sorry, this vehicle is not available for
        the selected dates.”
      </p>
      {error && <ErrorBox>{error}</ErrorBox>}
      <form onSubmit={add} className="grid gap-4 sm:grid-cols-4">
        <Field label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="auth-input" /></Field>
        <Field label="To (optional)"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="auth-input" /></Field>
        <Field label="Reason">
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="auth-input">
            <option value="maintenance">Maintenance</option>
            <option value="private">Private booking</option>
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
              <button onClick={async () => { await unblockDate(b.id); load(); }} className="text-red-500 hover:text-red-700">
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
 * Bookings / Reviews / Analytics
 * ============================================================ */

function BookingsPanel({
  bookings,
  onAct,
  onChat,
  unread,
}: {
  bookings: TransportBookingRow[];
  onAct: (id: string, status: "accepted" | "rejected") => void;
  onChat: (b: TransportBookingRow) => void;
  unread: Set<string>;
}) {
  if (bookings.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-muted/40 py-16 text-center">
        <CalendarCheck className="mx-auto h-10 w-10 text-forest-600" />
        <p className="mt-2 font-display text-lg font-semibold text-forest">No booking requests yet</p>
        <p className="text-sm text-muted-foreground">Transport and rental bookings appear here.</p>
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
                {transportBookingRef(b.id)} · {b.listing_type === "rental" ? "Vehicle Rental" : "Transport Service"}
              </p>
              <p className="font-display text-base font-semibold text-forest">{b.item_title}</p>
              <p className="text-sm font-semibold text-forest">
                {formatPrice(b.total_price)} · {b.passengers} passenger{b.passengers > 1 ? "s" : ""}
              </p>
            </div>
            {b.status !== "pending" && <BookingStatusBadge status={b.status} />}
          </div>
          <div className="mt-3 grid gap-2 rounded-xl bg-forest-50/50 p-3 text-sm sm:grid-cols-2">
            <KV k="Customer" v={b.customer_name ?? "—"} />
            <KV k="Phone" v={b.customer_phone ?? "—"} />
            <KV k="Pickup" v={b.pickup_location ?? "—"} />
            <KV k="Drop-off" v={b.dropoff_location ?? "—"} />
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

function ReviewsPanel({ provider }: { provider: TransportProviderRow }) {
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
            {provider.reviews} review{provider.reviews === 1 ? "" : "s"} across your listings
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Only customers with a confirmed booking can leave a review on your
        vehicles, so every rating is from a real trip.
      </p>
    </div>
  );
}

function AnalyticsPanel({
  provider,
  services,
  rentals,
  bookings,
}: {
  provider: TransportProviderRow;
  services: TransportServiceRow[];
  rentals: RentalVehicleRow[];
  bookings: TransportBookingRow[];
}) {
  const month = new Date().toISOString().slice(0, 7);
  const revenue = bookings
    .filter((b) => b.status === "accepted")
    .reduce((s, b) => s + (b.total_price || 0), 0);
  const monthlyRevenue = bookings
    .filter((b) => b.status === "accepted" && b.created_at?.slice(0, 7) === month)
    .reduce((s, b) => s + (b.total_price || 0), 0);
  const accepted = bookings.filter((b) => b.status === "accepted").length;
  const pending = bookings.filter((b) => b.status === "pending").length;
  const rejected = bookings.filter((b) => b.status === "rejected").length;

  // Most booked vehicle
  const counts = new Map<string, number>();
  for (const b of bookings) counts.set(b.item_title, (counts.get(b.item_title) ?? 0) + 1);
  const mostBooked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];

  // Monthly booking graph (last 6 months)
  const months: { label: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toISOString().slice(0, 7);
    months.push({
      label: d.toLocaleString("default", { month: "short" }),
      count: bookings.filter((b) => b.created_at?.slice(0, 7) === key).length,
    });
  }
  const maxCount = Math.max(1, ...months.map((m) => m.count));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Bus} label="Total vehicles" value={services.length + rentals.length} accent />
        <Stat icon={CalendarCheck} label="Total bookings" value={bookings.length} />
        <Stat icon={Database} label="Pending" value={pending} />
        <Stat icon={CheckCircle2} label="Confirmed" value={accepted} />
        <Stat icon={XCircle} label="Cancelled" value={rejected} />
        <Stat icon={Wallet} label="Revenue (all)" value={formatPrice(revenue)} />
        <Stat icon={Wallet} label="Revenue (month)" value={formatPrice(monthlyRevenue)} />
        <Stat icon={Users} label="Occupancy" value={`${bookings.length ? Math.round((accepted / bookings.length) * 100) : 0}%`} />
      </div>

      <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="h-4 w-4 text-forest-600" /> Monthly bookings
        </p>
        <div className="mt-4 flex items-end gap-3" style={{ height: 140 }}>
          {months.map((m) => (
            <div key={m.label} className="flex flex-1 flex-col items-center justify-end gap-2">
              <span className="text-xs font-bold text-forest">{m.count}</span>
              <div
                className="w-full rounded-t-lg bg-gradient-forest"
                style={{ height: `${(m.count / maxCount) * 100}%`, minHeight: m.count ? 6 : 2 }}
              />
              <span className="text-xs text-muted-foreground">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
          <p className="text-sm text-muted-foreground">Most booked vehicle</p>
          <p className="font-display text-xl font-bold text-forest">
            {mostBooked ? mostBooked[0] : "—"}
          </p>
          {mostBooked && <p className="text-sm text-muted-foreground">{mostBooked[1]} booking{mostBooked[1] > 1 ? "s" : ""}</p>}
        </div>
        <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
          <p className="text-sm text-muted-foreground">Overall rating</p>
          <p className="font-display text-xl font-bold text-forest">
            {Number(provider.rating || 0).toFixed(1)} · {provider.reviews} reviews
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
        <p className="text-sm text-muted-foreground">Customer history</p>
        {bookings.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No bookings yet.</p>
        ) : (
          <div className="mt-2 divide-y divide-border">
            {bookings.slice(0, 8).map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="font-medium text-forest">{b.customer_name ?? b.customer_email}</span>
                <span className="text-muted-foreground">{b.item_title}</span>
                <span className="text-muted-foreground">{b.created_at?.slice(0, 10)}</span>
                <BookingStatusBadge status={b.status} />
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

function ItemRow({
  image,
  title,
  subtitle,
  price,
  status,
  onEdit,
  onAvailability,
  onDelete,
}: {
  image: string | null;
  title: string;
  subtitle: string;
  price: string;
  status: string;
  onEdit: () => void;
  onAvailability?: () => void;
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
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="font-display font-bold text-forest">{price}</p>
          <div className="flex flex-wrap gap-2">
            {onAvailability && (
              <button onClick={onAvailability} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-forest hover:bg-muted"><CalendarX className="h-3.5 w-3.5" /> Availability</button>
            )}
            <button onClick={onEdit} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-forest hover:bg-muted"><Pencil className="h-3.5 w-3.5" /> Edit</button>
            <button onClick={onDelete} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: typeof Bus; label: string; value: string | number; accent?: boolean }) {
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
    rejected: { label: "Rejected", cls: "bg-red-50 text-red-600" },
    pending: { label: "Pending", cls: "bg-gold/20 text-gold-700" },
  };
  const s = map[status] ?? map.pending;
  return <span className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase", s.cls)}>{s.label}</span>;
}
