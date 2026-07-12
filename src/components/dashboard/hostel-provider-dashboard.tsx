"use client";

import * as React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Home,
  PlusCircle,
  UserRound,
  LogOut,
  MapPin,
  Trash2,
  Pencil,
  CheckCircle2,
  Database,
  Loader2,
  BedDouble,
  Users,
  CalendarCheck,
  UtensilsCrossed,
  XCircle,
  BarChart3,
  Wallet,
  TrendingUp,
  Star,
  MessageSquare,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ImageUpload, MultiImageUpload, AvatarUpload } from "@/components/ui/image-upload";
import { ChatModal } from "@/components/chat/chat-modal";
import { PaymentSettings } from "@/components/payments/payment-settings";
import { PaymentsManager } from "@/components/payments/payments-manager";
import { MessagesInbox } from "@/components/chat/messages-inbox";
import { ContactAdminButton } from "@/components/chat/contact-admin-button";
import { AccountSecurity } from "@/components/account/account-security";
import { OwnerCrm } from "@/components/crm/owner-crm";
import { PropertyRestaurantManager } from "@/components/dashboard/property-restaurant-manager";
import { useUnread } from "@/lib/use-unread";
import { type BookingRow } from "@/lib/bookings";
import { useAuth, type User } from "@/components/auth/auth-context";
import {
  getHostelsByOwner,
  createHostel,
  updateHostel,
  deleteHostel,
  getRoomsByHostel,
  replaceHostelRooms,
  getBookingRoomsForHostels,
  type HostelRow,
  type HostelRoomInput,
  type HostelBookingRoomRow,
} from "@/lib/hostels";
import {
  getHostelBookingsByOwner,
  setHostelBookingStatus,
  hostelBookingRef,
  type HostelBookingRow,
} from "@/lib/hostel-bookings";
import { setHostelBookingRoomsStatus } from "@/lib/hostels";
import { sendEmail, bookingStatusEmail } from "@/lib/email";
import { sendBookingStatusNotification } from "@/lib/messages";
import { cn, formatPrice } from "@/lib/utils";

const AMENITY_OPTIONS = [
  "Free Wi-Fi",
  "Kitchen access",
  "Mountain views",
  "Home-cooked meals",
  "Free parking",
  "Bonfire / garden",
  "Hot water",
  "Heating",
  "Laundry",
  "Local host guidance",
];

const ROOM_TYPES = ["Entire Home", "Private Room", "Shared Room"];
const LOCATIONS = ["Skardu", "Hunza", "Naran", "Gilgit", "Shigar", "Khaplu"];

type Tab =
  | "overview"
  | "hostels"
  | "bookings"
  | "payments"
  | "restaurant"
  | "analytics"
  | "messages"
  | "add"
  | "crm"
  | "profile";

const nav: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "hostels", label: "My Hostels", icon: Home },
  { id: "bookings", label: "Bookings", icon: CalendarCheck },
  { id: "payments", label: "Payments", icon: Wallet },
  { id: "restaurant", label: "Restaurant / Menu", icon: UtensilsCrossed },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "crm", label: "CRM & Insights", icon: BarChart3 },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "add", label: "Add Hostel", icon: PlusCircle },
  { id: "profile", label: "Business Profile", icon: UserRound },
];

type RoomDraft = {
  name: string;
  room_type: string;
  total_units: string;
  max_guests: string;
  beds: string;
  bedrooms: string;
  bathrooms: string;
  room_size: string;
  price: string;
  weekend_price: string;
  seasonal_price: string;
  extra_guest_charges: string;
  images: string[];
  description: string;
  amenities: string; // comma separated
};

const emptyRoom: RoomDraft = {
  name: "",
  room_type: "Entire Home",
  total_units: "1",
  max_guests: "2",
  beds: "",
  bedrooms: "",
  bathrooms: "",
  room_size: "",
  price: "",
  weekend_price: "",
  seasonal_price: "",
  extra_guest_charges: "",
  images: [],
  description: "",
  amenities: "",
};

const empty = {
  title: "",
  category_label: "Hostel",
  location: "Skardu",
  address: "",
  map_link: "",
  image: "",
  description: "",
  amenities: [] as string[],
  gallery: [] as string[],
  checkin_time: "2:00 PM",
  checkout_time: "11:00 AM",
  house_rules: "",
  cancellation_policy: "",
  blocked_dates: "",
  maintenance_dates: "",
  min_stay: "1",
  max_stay: "",
  featured: false,
  reg_number: "",
  license_doc: "",
  owner_cnic: "",
  owner_cnic_doc: "",
  ownership_doc: "",
  rooms: [{ ...emptyRoom }] as RoomDraft[],
};

function parseDates(s: string): string[] {
  return s
    .split(/[\n,]+/)
    .map((d) => d.trim())
    .filter(Boolean);
}

function num(v: string): number | null {
  const n = Number(v);
  return v.trim() && !Number.isNaN(n) ? n : null;
}

export function HostelProviderDashboard({
  user,
  onSignOut,
}: {
  user: User;
  onSignOut: () => void;
}) {
  const [tab, setTab] = React.useState<Tab>("overview");
  const [hostels, setHostels] = React.useState<HostelRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ ...empty });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [bookings, setBookings] = React.useState<HostelBookingRow[]>([]);
  const [brooms, setBrooms] = React.useState<HostelBookingRoomRow[]>([]);
  const [chatBooking, setChatBooking] = React.useState<BookingRow | null>(null);

  const refresh = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [h, b] = await Promise.all([
      getHostelsByOwner(user.email),
      getHostelBookingsByOwner(user.email),
    ]);
    setHostels(h);
    setBookings(b);
    setBrooms(await getBookingRoomsForHostels(h.map((x) => x.id)));
    if (!silent) setLoading(false);
  }, [user.email]);

  React.useEffect(() => {
    refresh();
    const t = setInterval(() => { if (document.visibilityState === "visible") refresh(true); }, 45000);
    return () => clearInterval(t);
  }, [refresh]);

  // The shared chat UI expects the hotel BookingRow shape; adapt hostel rows.
  const toBookingRow = (b: HostelBookingRow): BookingRow => ({
    ...b,
    hotel_id: b.hostel_id,
    hotel_title: b.hostel_title,
  });
  const bookingRows = bookings.map(toBookingRow);
  const { unread, markSeen } = useUnread(
    bookings.map((b) => b.id),
    user.email,
    { sound: false }
  );
  const openChatRow = (r: BookingRow) => {
    markSeen(r.id);
    setChatBooking(r);
  };
  const openChat = (b: HostelBookingRow) => openChatRow(toBookingRow(b));

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
    const handler = (e: Event) =>
      tryOpen((e as CustomEvent<string>).detail);
    window.addEventListener("safarigb:open-chat", handler);
    return () => window.removeEventListener("safarigb:open-chat", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings]);

  const pendingBookings = bookings.filter((b) => b.status === "pending").length;
  const today = new Date().toISOString().slice(0, 10);

  const totalRooms = hostels.reduce((s, x) => s + (x.total_rooms || 0), 0);
  const reservedUnits = brooms
    .filter((x) => x.status === "pending")
    .reduce((s, x) => s + (x.units || 0), 0);
  const bookedUnits = brooms
    .filter((x) => x.status === "accepted")
    .reduce((s, x) => s + (x.units || 0), 0);
  const availableUnits = Math.max(0, totalRooms - reservedUnits - bookedUnits);
  const occupancy =
    totalRooms > 0
      ? Math.round(((reservedUnits + bookedUnits) / totalRooms) * 100)
      : 0;
  const month = today.slice(0, 7);
  const monthlyRevenue = bookings
    .filter((b) => b.status === "accepted" && b.created_at?.slice(0, 7) === month)
    .reduce((s, b) => s + (b.total_price || 0), 0);

  const inv = {
    totalRooms,
    reservedUnits,
    bookedUnits,
    availableUnits,
    occupancy,
    totalBookings: bookings.length,
    monthlyRevenue,
    totalGuests: bookings
      .filter((b) => b.status === "accepted")
      .reduce((s, b) => s + (b.guests || 0), 0),
  };

  const handleBookingAct = async (
    id: string,
    status: "accepted" | "rejected"
  ) => {
    const b = bookings.find((x) => x.id === id);
    await setHostelBookingStatus(id, status);
    await setHostelBookingRoomsStatus(id, status);
    if (b) {
      sendEmail(
        b.customer_email,
        status === "accepted"
          ? "Your Rego hostel booking is confirmed"
          : "Rego booking update",
        bookingStatusEmail({
          name: b.customer_name ?? "Guest",
          hotel: b.hostel_title,
          ref: hostelBookingRef(b.id),
          accepted: status === "accepted",
        })
      );
      await sendBookingStatusNotification({
        booking_id: b.id,
        owner_email: user.email,
        owner_name: b.hostel_title ?? user.name,
        ref: hostelBookingRef(b.id),
        itemTitle: b.hostel_title,
        status,
      });
    }
    await refresh();
  };

  const startEdit = async (h: HostelRow) => {
    setEditingId(h.id);
    const rooms = await getRoomsByHostel(h.id);
    setForm({
      title: h.title,
      category_label: h.category_label,
      location: h.location,
      address: h.address ?? "",
      map_link: h.map_link ?? "",
      image: h.image ?? "",
      description: h.description ?? "",
      amenities: h.amenities ?? [],
      gallery: h.gallery ?? [],
      checkin_time: h.checkin_time ?? "",
      checkout_time: h.checkout_time ?? "",
      house_rules: h.house_rules ?? "",
      cancellation_policy: h.cancellation_policy ?? "",
      blocked_dates: (h.blocked_dates ?? []).join(", "),
      maintenance_dates: (h.maintenance_dates ?? []).join(", "),
      min_stay: h.min_stay != null ? String(h.min_stay) : "",
      max_stay: h.max_stay != null ? String(h.max_stay) : "",
      featured: h.featured,
      reg_number: h.reg_number ?? "",
      license_doc: h.license_doc ?? "",
      owner_cnic: h.owner_cnic ?? "",
      owner_cnic_doc: h.owner_cnic_doc ?? "",
      ownership_doc: h.ownership_doc ?? "",
      rooms:
        rooms.length > 0
          ? rooms.map((r) => ({
              name: r.name,
              room_type: r.room_type ?? "Entire Home",
              total_units: String(r.total_units ?? 1),
              max_guests: String(r.max_guests ?? 2),
              beds: r.beds ?? "",
              bedrooms: r.bedrooms != null ? String(r.bedrooms) : "",
              bathrooms: r.bathrooms != null ? String(r.bathrooms) : "",
              room_size: r.room_size ?? "",
              price: String(r.price ?? ""),
              weekend_price: r.weekend_price != null ? String(r.weekend_price) : "",
              seasonal_price: r.seasonal_price != null ? String(r.seasonal_price) : "",
              extra_guest_charges:
                r.extra_guest_charges != null ? String(r.extra_guest_charges) : "",
              images: r.images ?? [],
              description: r.description ?? "",
              amenities: (r.amenities ?? []).join(", "),
            }))
          : [{ ...emptyRoom }],
    });
    setTab("add");
  };

  const resetForm = () => {
    setForm({ ...empty, rooms: [{ ...emptyRoom }] });
    setEditingId(null);
    setError("");
  };

  const updateRoom = (i: number, patch: Partial<RoomDraft>) =>
    setForm((f) => ({
      ...f,
      rooms: f.rooms.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    }));
  const addRoom = () =>
    setForm((f) => ({ ...f, rooms: [...f.rooms, { ...emptyRoom }] }));
  const removeRoom = (i: number) =>
    setForm((f) => ({ ...f, rooms: f.rooms.filter((_, idx) => idx !== i) }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) {
      setError("Please enter a hostel name.");
      return;
    }
    const roomInputs: Omit<HostelRoomInput, "hostel_id">[] = form.rooms
      .filter((r) => r.name.trim() && Number(r.price))
      .map((r) => ({
        name: r.name.trim(),
        room_type: r.room_type,
        total_units: Number(r.total_units) || 1,
        max_guests: Number(r.max_guests) || 2,
        beds: r.beds.trim() || null,
        bedrooms: num(r.bedrooms),
        bathrooms: num(r.bathrooms),
        room_size: r.room_size.trim() || null,
        price: Number(r.price),
        weekend_price: num(r.weekend_price),
        seasonal_price: num(r.seasonal_price),
        extra_guest_charges: num(r.extra_guest_charges),
        images: r.images,
        description: r.description.trim() || null,
        amenities: r.amenities
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
      }));

    if (roomInputs.length === 0) {
      setError("Add at least one room type with a name and a price per night.");
      return;
    }

    const startingPrice = Math.min(...roomInputs.map((r) => r.price));
    const totalUnits = roomInputs.reduce(
      (s, r) => s + (r.total_units ?? 1),
      0
    );

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      category_label: form.category_label.trim() || "Hostel",
      location: form.location,
      address: form.address.trim() || null,
      map_link: form.map_link.trim() || null,
      price: startingPrice,
      unit: "night",
      image:
        form.image.trim() ||
        `https://picsum.photos/seed/hostel-${
          Math.floor(Math.random() * 90) + 70
        }/900/600`,
      description: form.description.trim() || null,
      amenities: form.amenities,
      gallery: form.gallery,
      checkin_time: form.checkin_time.trim() || null,
      checkout_time: form.checkout_time.trim() || null,
      house_rules: form.house_rules.trim() || null,
      cancellation_policy: form.cancellation_policy.trim() || null,
      blocked_dates: parseDates(form.blocked_dates),
      maintenance_dates: parseDates(form.maintenance_dates),
      min_stay: num(form.min_stay),
      max_stay: num(form.max_stay),
      total_rooms: totalUnits,
      reg_number: form.reg_number.trim() || null,
      license_doc: form.license_doc.trim() || null,
      owner_cnic: form.owner_cnic.trim() || null,
      owner_cnic_doc: form.owner_cnic_doc.trim() || null,
      ownership_doc: form.ownership_doc.trim() || null,
      owner_email: user.email,
    };

    const { data, error: dbError } = editingId
      ? await updateHostel(editingId, payload)
      : await createHostel(payload);

    if (dbError) {
      setSaving(false);
      setError(dbError.message);
      return;
    }

    const hostelId = editingId ?? (data as HostelRow | null)?.id;
    if (hostelId) {
      await replaceHostelRooms(hostelId, roomInputs);
    }
    setSaving(false);
    resetForm();
    await refresh();
    setTab("hostels");
  };

  const remove = async (id: string) => {
    await deleteHostel(id);
    await refresh();
  };

  return (
    <div className="container-px py-10">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-3xl font-bold text-forest">
          Welcome, {user.name.split(" ")[0]}
        </h1>
        <span className="inline-flex items-center gap-1 rounded-full bg-gradient-forest px-2.5 py-1 text-xs font-semibold text-white shadow-soft">
          <Database className="h-3.5 w-3.5" /> Saved to database
        </span>
      </div>
      <p className="mt-1 text-muted-foreground">
        Manage your hostel listings — they go live once an admin approves them.
      </p>
      <div className="mt-3">
        <ContactAdminButton ownerEmail={user.email} ownerName={user.name} ownerAvatar={user.avatar} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        {/* Sidebar */}
        <aside>
          <div className="sticky top-24 rounded-3xl border border-border/70 bg-card p-3 shadow-premium">
            <div className="flex items-center gap-3 border-b border-border p-3">
              <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-gradient-gold text-forest-900">
                {user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Home className="h-6 w-6" />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-forest">{user.name}</p>
                <span className="mt-1 inline-block rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-gold-700">
                  Hostels · Partner
                </span>
              </div>
            </div>
            <nav className="mt-2 space-y-1">
              {nav.map((n) => {
                const Icon = n.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => {
                      if (n.id === "add") resetForm();
                      setTab(n.id);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                      tab === n.id
                        ? "bg-gradient-forest text-white shadow-soft"
                        : "text-forest hover:bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {n.id === "add" && editingId ? "Edit Hostel" : n.label}
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

        {/* Content */}
        <div>
          {tab === "overview" && (
            <Overview
              count={hostels.length}
              loading={loading}
              inv={inv}
              onAdd={() => {
                resetForm();
                setTab("add");
              }}
            />
          )}

          {tab === "hostels" && (
            <MyHostels
              hostels={hostels}
              loading={loading}
              onEdit={startEdit}
              onDelete={remove}
              onAdd={() => {
                resetForm();
                setTab("add");
              }}
            />
          )}

          {tab === "add" && (
            <HostelForm
              form={form}
              setForm={setForm}
              editingId={editingId}
              saving={saving}
              error={error}
              onSubmit={save}
              onCancel={() => {
                resetForm();
                setTab("hostels");
              }}
              updateRoom={updateRoom}
              addRoom={addRoom}
              removeRoom={removeRoom}
            />
          )}

          {tab === "payments" && (
            <div className="space-y-8">
              <PaymentsManager table="hostel_bookings" bookings={bookings} onChange={refresh} senderEmail={user.email} senderName={user.name} />
              <PaymentSettings tables={["hostels"]} ownerEmail={user.email} />
            </div>
          )}

          {tab === "bookings" && (
            <BookingsPanel
              bookings={bookings}
              loading={loading}
              onAct={handleBookingAct}
              onChat={openChat}
              unread={unread}
            />
          )}

          {tab === "restaurant" && (
            <PropertyRestaurantManager
              user={user}
              propertyType="hostel"
              propertyId={hostels[0]?.id ?? null}
              propertyName={hostels[0]?.title ?? null}
            />
          )}

          {tab === "analytics" && (
            <AnalyticsView inv={inv} bookings={bookings} loading={loading} />
          )}

          {tab === "messages" && (
            <MessagesInbox
              bookings={bookingRows}
              unread={unread}
              otherLabelFor={(b) => b.customer_name ?? b.customer_email}
              onOpen={openChatRow}
            />
          )}

          {tab === "crm" && <OwnerCrm user={user} />}
          {tab === "profile" && <Profile user={user} />}
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

/* ---------------- Overview ---------------- */

function InvCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Home;
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card p-4 shadow-premium">
      <span
        className={cn(
          "grid h-11 w-11 place-items-center rounded-2xl",
          accent ? "bg-gradient-gold text-forest-900" : "bg-gradient-forest text-gold"
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 font-display text-2xl font-bold text-forest">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Overview({
  count,
  loading,
  inv,
  onAdd,
}: {
  count: number;
  loading: boolean;
  inv: {
    totalRooms: number;
    reservedUnits: number;
    bookedUnits: number;
    availableUnits: number;
    occupancy: number;
    totalBookings: number;
    monthlyRevenue: number;
    totalGuests: number;
  };
  onAdd: () => void;
}) {
  const L = (v: number | string) => (loading ? "…" : v);
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border/70 bg-gradient-forest p-5 text-white shadow-premium">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/80">Occupancy rate</p>
            <p className="font-display text-3xl font-extrabold text-gold">
              {inv.occupancy}%
            </p>
          </div>
          <div className="text-right text-sm text-white/80">
            <p>{count} hostel{count !== 1 ? "s" : ""}</p>
            <p>{inv.totalRooms} total rooms</p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-gold"
            style={{ width: `${inv.occupancy}%` }}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InvCard icon={Home} label="Total rooms" value={L(inv.totalRooms)} />
        <InvCard icon={Database} label="Available rooms" value={L(inv.availableUnits)} accent />
        <InvCard icon={CalendarCheck} label="Reserved (pending)" value={L(inv.reservedUnits)} />
        <InvCard icon={CheckCircle2} label="Booked (confirmed)" value={L(inv.bookedUnits)} />
        <InvCard icon={Star} label="Total bookings" value={L(inv.totalBookings)} />
        <InvCard icon={Users} label="Guests served" value={L(inv.totalGuests)} />
        <InvCard icon={Wallet} label="Revenue (this month)" value={loading ? "…" : formatPrice(inv.monthlyRevenue)} />
        <InvCard icon={TrendingUp} label="Occupancy" value={L(`${inv.occupancy}%`)} />
      </div>

      <div className="rounded-3xl border border-border/70 bg-card p-8 text-center shadow-premium">
        <PlusCircle className="mx-auto h-10 w-10 text-forest-600" />
        <h2 className="mt-3 font-display text-lg font-bold text-forest">
          {count === 0 ? "Add your first hostel" : "Add another hostel"}
        </h2>
        <p className="mt-1 text-muted-foreground">
          Submit your hostel — it appears on the site once an admin approves it.
        </p>
        <Button variant="gold" className="mt-5 rounded-lg" onClick={onAdd}>
          Add hostel
        </Button>
      </div>
    </div>
  );
}

/* ---------------- My Hostels ---------------- */

function MyHostels({
  hostels,
  loading,
  onEdit,
  onDelete,
  onAdd,
}: {
  hostels: HostelRow[];
  loading: boolean;
  onEdit: (h: HostelRow) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  if (loading) {
    return (
      <div className="grid place-items-center rounded-3xl border border-border/70 bg-card py-20 text-muted-foreground shadow-premium">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (hostels.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-muted/40 py-16 text-center">
        <p className="font-display text-lg font-semibold text-forest">
          No hostels yet
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Add your hostel to publish it on the site.
        </p>
        <Button variant="gold" className="mt-5 rounded-lg" onClick={onAdd}>
          Add hostel
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {hostels.map((h) => (
        <div
          key={h.id}
          className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-card p-4 shadow-premium sm:flex-row"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={h.image ?? ""}
            alt={h.title}
            className="h-32 w-full shrink-0 rounded-xl object-cover sm:h-24 sm:w-32"
          />
          <div className="flex-1">
            <div className="flex items-start justify-between gap-2">
              <Link
                href={`/listings/${h.id}`}
                className="font-display text-lg font-semibold text-forest hover:text-gold"
              >
                {h.title}
              </Link>
              <StatusBadge status={h.status} />
            </div>
            <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {h.location} · {h.total_rooms} room
              {h.total_rooms !== 1 ? "s" : ""}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <p className="font-display font-bold text-forest">
                From {formatPrice(h.price)}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  / night
                </span>
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => onEdit(h)}
                  className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-forest hover:bg-muted"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  onClick={() => onDelete(h.id)}
                  className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Add / Edit form (with embedded room config) ---------------- */

function HostelForm({
  form,
  setForm,
  editingId,
  saving,
  error,
  onSubmit,
  onCancel,
  updateRoom,
  addRoom,
  removeRoom,
}: {
  form: typeof empty;
  setForm: React.Dispatch<React.SetStateAction<typeof empty>>;
  editingId: string | null;
  saving: boolean;
  error: string;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  updateRoom: (i: number, patch: Partial<RoomDraft>) => void;
  addRoom: () => void;
  removeRoom: (i: number) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="space-y-6 rounded-3xl border border-border/70 bg-card p-6 shadow-premium sm:p-8"
    >
      <div>
        <h2 className="font-display text-xl font-bold text-forest">
          {editingId ? "Edit hostel" : "Add a new hostel"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add your hostel details, room types and availability — all in one place.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* --- Hostel information --- */}
      <SectionTitle>Hostel information</SectionTitle>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Hostel name" required>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Hunza View Hostel"
            className="auth-input"
          />
        </Field>
        <Field label="Type / label">
          <input
            value={form.category_label}
            onChange={(e) => setForm({ ...form, category_label: e.target.value })}
            placeholder="Hostel / Guest House / Farm Stay"
            className="auth-input"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Location" required>
          <select
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="auth-input"
          >
            {LOCATIONS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Location map link (Google Maps)">
          <input
            value={form.map_link}
            onChange={(e) => setForm({ ...form, map_link: e.target.value })}
            placeholder="https://maps.google.com/…"
            className="auth-input"
          />
        </Field>
      </div>

      <Field label="Complete address">
        <input
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          placeholder="Street, village, near landmark, Gilgit-Baltistan"
          className="auth-input"
        />
      </Field>

      <Field label="Description">
        <textarea
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Describe your hostel, the area and what makes it special…"
          className="auth-input resize-none"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Check-in time">
          <input
            value={form.checkin_time}
            onChange={(e) => setForm({ ...form, checkin_time: e.target.value })}
            placeholder="e.g. 2:00 PM"
            className="auth-input"
          />
        </Field>
        <Field label="Check-out time">
          <input
            value={form.checkout_time}
            onChange={(e) => setForm({ ...form, checkout_time: e.target.value })}
            placeholder="e.g. 11:00 AM"
            className="auth-input"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="House rules">
          <textarea
            rows={3}
            value={form.house_rules}
            onChange={(e) => setForm({ ...form, house_rules: e.target.value })}
            placeholder="No smoking indoors, quiet hours after 10 PM…"
            className="auth-input resize-none"
          />
        </Field>
        <Field label="Cancellation policy">
          <textarea
            rows={3}
            value={form.cancellation_policy}
            onChange={(e) =>
              setForm({ ...form, cancellation_policy: e.target.value })
            }
            placeholder="Free cancellation up to 48 hours before check-in…"
            className="auth-input resize-none"
          />
        </Field>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-semibold text-forest">
          Cover image
        </span>
        <ImageUpload
          value={form.image}
          onChange={(url) => setForm({ ...form, image: url })}
        />
        <input
          value={form.image}
          onChange={(e) => setForm({ ...form, image: e.target.value })}
          placeholder="…or paste an image URL"
          className="auth-input mt-2"
        />
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-semibold text-forest">
          Gallery images
        </span>
        <MultiImageUpload
          value={form.gallery}
          onChange={(urls) => setForm({ ...form, gallery: urls })}
        />
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-semibold text-forest">
          Amenities
        </span>
        <div className="flex flex-wrap gap-2">
          {AMENITY_OPTIONS.map((a) => {
            const on = form.amenities.includes(a);
            return (
              <button
                type="button"
                key={a}
                onClick={() =>
                  setForm({
                    ...form,
                    amenities: on
                      ? form.amenities.filter((x) => x !== a)
                      : [...form.amenities, a],
                  })
                }
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  on
                    ? "bg-gradient-forest text-white shadow-soft"
                    : "border border-border bg-white text-forest hover:border-forest/40"
                )}
              >
                {a}
              </button>
            );
          })}
        </div>
      </div>

      {/* --- Room configuration (embedded) --- */}
      <SectionTitle>Room configuration</SectionTitle>
      <p className="-mt-3 text-sm text-muted-foreground">
        Add every room type you offer. Guests book these directly — no separate
        room page needed.
      </p>

      <div className="space-y-5">
        {form.rooms.map((r, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-forest-50/30 p-4 sm:p-5"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-display text-base font-bold text-forest">
                Room type {i + 1}
              </h4>
              {form.rooms.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRoom(i)}
                  className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              )}
            </div>

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Room name" required>
                <input
                  value={r.name}
                  onChange={(e) => updateRoom(i, { name: e.target.value })}
                  placeholder="e.g. Cozy Mountain Room"
                  className="auth-input"
                />
              </Field>
              <Field label="Room type">
                <select
                  value={r.room_type}
                  onChange={(e) => updateRoom(i, { room_type: e.target.value })}
                  className="auth-input"
                >
                  {ROOM_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Total units available" required>
                <input
                  type="number"
                  value={r.total_units}
                  onChange={(e) => updateRoom(i, { total_units: e.target.value })}
                  placeholder="e.g. 3"
                  className="auth-input"
                />
              </Field>
              <Field label="Maximum guests">
                <input
                  type="number"
                  value={r.max_guests}
                  onChange={(e) => updateRoom(i, { max_guests: e.target.value })}
                  className="auth-input"
                />
              </Field>
              <Field label="Number of beds">
                <input
                  value={r.beds}
                  onChange={(e) => updateRoom(i, { beds: e.target.value })}
                  placeholder="e.g. 2 Beds"
                  className="auth-input"
                />
              </Field>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Bedrooms">
                <input
                  type="number"
                  value={r.bedrooms}
                  onChange={(e) => updateRoom(i, { bedrooms: e.target.value })}
                  className="auth-input"
                />
              </Field>
              <Field label="Bathrooms">
                <input
                  type="number"
                  value={r.bathrooms}
                  onChange={(e) => updateRoom(i, { bathrooms: e.target.value })}
                  className="auth-input"
                />
              </Field>
              <Field label="Room size">
                <input
                  value={r.room_size}
                  onChange={(e) => updateRoom(i, { room_size: e.target.value })}
                  placeholder="e.g. 300 sq ft"
                  className="auth-input"
                />
              </Field>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Price / night (PKR)" required>
                <input
                  type="number"
                  value={r.price}
                  onChange={(e) => updateRoom(i, { price: e.target.value })}
                  placeholder="8000"
                  className="auth-input"
                />
              </Field>
              <Field label="Weekend price">
                <input
                  type="number"
                  value={r.weekend_price}
                  onChange={(e) => updateRoom(i, { weekend_price: e.target.value })}
                  placeholder="optional"
                  className="auth-input"
                />
              </Field>
              <Field label="Seasonal price">
                <input
                  type="number"
                  value={r.seasonal_price}
                  onChange={(e) => updateRoom(i, { seasonal_price: e.target.value })}
                  placeholder="optional"
                  className="auth-input"
                />
              </Field>
              <Field label="Extra guest charges">
                <input
                  type="number"
                  value={r.extra_guest_charges}
                  onChange={(e) =>
                    updateRoom(i, { extra_guest_charges: e.target.value })
                  }
                  placeholder="optional"
                  className="auth-input"
                />
              </Field>
            </div>

            <Field label="Room description">
              <textarea
                rows={2}
                value={r.description}
                onChange={(e) => updateRoom(i, { description: e.target.value })}
                placeholder="What makes this room special…"
                className="auth-input resize-none"
              />
            </Field>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Room amenities (comma separated)">
                <input
                  value={r.amenities}
                  onChange={(e) => updateRoom(i, { amenities: e.target.value })}
                  placeholder="Attached bathroom, Heater, Balcony"
                  className="auth-input"
                />
              </Field>
              <div>
                <span className="mb-1.5 block text-sm font-semibold text-forest">
                  Room images
                </span>
                <MultiImageUpload
                  value={r.images}
                  onChange={(urls) => updateRoom(i, { images: urls })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        className="rounded-lg"
        onClick={addRoom}
      >
        <PlusCircle className="h-4 w-4" /> Add room
      </Button>

      {/* --- Availability management --- */}
      <SectionTitle>Availability management</SectionTitle>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Blocked dates">
          <textarea
            rows={2}
            value={form.blocked_dates}
            onChange={(e) => setForm({ ...form, blocked_dates: e.target.value })}
            placeholder="2026-07-10, 2026-07-11 (comma or new line)"
            className="auth-input resize-none"
          />
        </Field>
        <Field label="Maintenance dates">
          <textarea
            rows={2}
            value={form.maintenance_dates}
            onChange={(e) =>
              setForm({ ...form, maintenance_dates: e.target.value })
            }
            placeholder="2026-08-01, 2026-08-02"
            className="auth-input resize-none"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Minimum stay (nights)">
          <input
            type="number"
            value={form.min_stay}
            onChange={(e) => setForm({ ...form, min_stay: e.target.value })}
            placeholder="e.g. 1"
            className="auth-input"
          />
        </Field>
        <Field label="Maximum stay (nights)">
          <input
            type="number"
            value={form.max_stay}
            onChange={(e) => setForm({ ...form, max_stay: e.target.value })}
            placeholder="e.g. 14"
            className="auth-input"
          />
        </Field>
      </div>

      {/* --- Verification --- */}
      <SectionTitle>Verification documents</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Registration / license number">
          <input
            value={form.reg_number}
            onChange={(e) => setForm({ ...form, reg_number: e.target.value })}
            placeholder="e.g. GB-HS-2024-00123"
            className="auth-input"
          />
        </Field>
        <Field label="Owner ID (CNIC) number">
          <input
            value={form.owner_cnic}
            onChange={(e) => setForm({ ...form, owner_cnic: e.target.value })}
            placeholder="e.g. 71101-1234567-1"
            className="auth-input"
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-forest">
            Certificate / license
          </span>
          <ImageUpload
            value={form.license_doc}
            onChange={(url) => setForm({ ...form, license_doc: url })}
          />
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-forest">
            Owner ID photo
          </span>
          <ImageUpload
            value={form.owner_cnic_doc}
            onChange={(url) => setForm({ ...form, owner_cnic_doc: url })}
          />
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-forest">
            Ownership / lease proof
          </span>
          <ImageUpload
            value={form.ownership_doc}
            onChange={(url) => setForm({ ...form, ownership_doc: url })}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" variant="gold" size="lg" className="rounded-lg" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving…
            </>
          ) : editingId ? (
            "Save changes"
          ) : (
            "Publish hostel"
          )}
        </Button>
        {editingId && (
          <Button type="button" variant="outline" size="lg" className="rounded-lg" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-border pb-2">
      <h3 className="font-display text-base font-bold text-forest">{children}</h3>
    </div>
  );
}

/* ---------------- Bookings ---------------- */

function BookingsPanel({
  bookings,
  loading,
  onAct,
  onChat,
  unread,
}: {
  bookings: HostelBookingRow[];
  loading: boolean;
  onAct: (id: string, status: "accepted" | "rejected") => void;
  onChat: (b: HostelBookingRow) => void;
  unread: Set<string>;
}) {
  if (loading) {
    return (
      <div className="grid place-items-center rounded-3xl border border-border/70 bg-card py-20 text-muted-foreground shadow-premium">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (bookings.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-muted/40 py-16 text-center">
        <CalendarCheck className="mx-auto h-10 w-10 text-forest-600" />
        <p className="mt-2 font-display text-lg font-semibold text-forest">
          No booking requests yet
        </p>
        <p className="text-sm text-muted-foreground">
          When guests book your hostels, requests appear here.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {bookings.map((b) => (
        <div
          key={b.id}
          className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-xs font-bold tracking-wider text-forest-600">
                {hostelBookingRef(b.id)}
              </p>
              <p className="font-display text-base font-semibold text-forest">
                {b.hostel_title}
                {b.room_name ? ` · ${b.room_name}` : ""}
              </p>
              <p className="text-sm font-semibold text-forest">
                {formatPrice(b.total_price)} · {b.rooms ?? 1} room
                {(b.rooms ?? 1) > 1 ? "s" : ""} · {b.guests} guest
                {b.guests > 1 ? "s" : ""}
              </p>
            </div>
            {b.status !== "pending" && <BookingStatusBadge status={b.status} />}
          </div>

          <div className="mt-3 grid gap-2 rounded-xl bg-forest-50/50 p-3 text-sm sm:grid-cols-2">
            <Detail label="Guest" value={b.customer_name ?? "—"} />
            <Detail label="From (city)" value={b.customer_city ?? "—"} />
            <Detail label="Phone" value={b.customer_phone ?? "—"} />
            <Detail label="Email" value={b.customer_email} />
            <Detail label="Check-in" value={b.check_in ?? "—"} />
            <Detail label="Check-out" value={b.check_out ?? "—"} />
          </div>
          {b.notes && (
            <p className="mt-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-forest">
              <span className="font-semibold">Note:</span> {b.notes}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {b.status === "pending" && (
              <>
                <button
                  onClick={() => onAct(b.id, "accepted")}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-forest px-3.5 py-2 text-sm font-semibold text-white shadow-soft hover:-translate-y-0.5"
                >
                  <CheckCircle2 className="h-4 w-4" /> Accept
                </button>
                <button
                  onClick={() => onAct(b.id, "rejected")}
                  className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4" /> Reject
                </button>
              </>
            )}
            <button
              onClick={() => onChat(b)}
              className={cn(
                "relative flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                unread.has(b.id)
                  ? "border-red-300 bg-red-50 text-red-600"
                  : "border-border text-forest hover:bg-muted"
              )}
            >
              <MessageSquare className="h-4 w-4" /> Message
              {unread.has(b.id) && (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500" />
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Analytics ---------------- */

function AnalyticsView({
  inv,
  bookings,
  loading,
}: {
  inv: {
    totalRooms: number;
    reservedUnits: number;
    bookedUnits: number;
    availableUnits: number;
    occupancy: number;
    totalBookings: number;
    monthlyRevenue: number;
    totalGuests: number;
  };
  bookings: HostelBookingRow[];
  loading: boolean;
}) {
  // Booking trends: count per month for the last 6 months.
  const months: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString("en-US", { month: "short" }),
    });
  }
  const trend = months.map((m) => ({
    ...m,
    count: bookings.filter((b) => b.created_at?.slice(0, 7) === m.key).length,
  }));
  const maxCount = Math.max(1, ...trend.map((t) => t.count));

  if (loading) {
    return (
      <div className="grid place-items-center rounded-3xl border border-border/70 bg-card py-20 text-muted-foreground shadow-premium">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InvCard icon={Home} label="Total rooms" value={inv.totalRooms} />
        <InvCard icon={CalendarCheck} label="Total bookings" value={inv.totalBookings} />
        <InvCard icon={Database} label="Reserved rooms" value={inv.reservedUnits} />
        <InvCard icon={CheckCircle2} label="Available rooms" value={inv.availableUnits} accent />
        <InvCard icon={TrendingUp} label="Occupancy rate" value={`${inv.occupancy}%`} />
        <InvCard icon={Wallet} label="Monthly revenue" value={formatPrice(inv.monthlyRevenue)} />
        <InvCard icon={Users} label="Guests served" value={inv.totalGuests} />
        <InvCard icon={CheckCircle2} label="Booked rooms" value={inv.bookedUnits} />
      </div>

      {/* Booking trends */}
      <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-premium">
        <h3 className="font-display text-base font-bold text-forest">
          Booking trends (last 6 months)
        </h3>
        <div className="mt-5 flex items-end justify-between gap-3" style={{ height: 160 }}>
          {trend.map((t) => (
            <div key={t.key} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-lg bg-gradient-forest"
                  style={{ height: `${(t.count / maxCount) * 100}%`, minHeight: 4 }}
                  title={`${t.count} bookings`}
                />
              </div>
              <span className="text-xs font-semibold text-forest">{t.count}</span>
              <span className="text-[11px] text-muted-foreground">{t.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Guest history */}
      <div className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-premium">
        <div className="border-b border-border px-5 py-4">
          <h3 className="font-display text-base font-bold text-forest">
            Guest history
          </h3>
        </div>
        {bookings.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No guests yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Guest</th>
                  <th className="px-4 py-3 font-semibold">Hostel</th>
                  <th className="px-4 py-3 font-semibold">Dates</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-forest">
                      {b.customer_name ?? b.customer_email}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {b.hostel_title}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {b.check_in ?? "—"} → {b.check_out ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-forest">
                      {formatPrice(b.total_price)}
                    </td>
                    <td className="px-4 py-3">
                      <BookingStatusBadge status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Profile({ user }: { user: User }) {
  const { updateProfile } = useAuth();
  const [name, setName] = React.useState(user.name);
  const [saved, setSaved] = React.useState(false);
  return (
    <>
    <form
      onSubmit={(e) => {
        e.preventDefault();
        updateProfile({ name });
        setSaved(true);
      }}
      className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-premium sm:p-8"
    >
      <h2 className="font-display text-xl font-bold text-forest">Host profile</h2>
      <div className="flex items-center gap-4">
        <AvatarUpload value={user.avatar ?? ""} onChange={(url) => updateProfile({ avatar: url })} />
        <div>
          <p className="font-semibold text-forest">{user.name}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Tap the photo to upload your picture</p>
        </div>
      </div>
      {saved && (
        <div className="flex items-center gap-2 rounded-lg border border-forest-200 bg-forest-50 px-4 py-2.5 text-sm font-medium text-forest-600">
          <CheckCircle2 className="h-4 w-4" /> Saved
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input className="auth-input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email">
          <input className="auth-input" defaultValue={user.email} readOnly />
        </Field>
      </div>
      <Button type="submit" variant="gold" className="rounded-lg">Save changes</Button>
    </form>
    <AccountSecurity />
    </>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium text-forest">{value}</p>
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
