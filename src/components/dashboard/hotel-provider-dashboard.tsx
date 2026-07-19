"use client";

import * as React from "react";
import { useDashboardDrill, DashboardBack } from "@/components/dashboard/dashboard-drill";
import Link from "next/link";
import {
  LayoutDashboard,
  Building2,
  PlusCircle,
  UserRound,
  LogOut,
  MapPin,
  Trash2,
  Pencil,
  CheckCircle2,
  Star,
  Database,
  Loader2,
  BedDouble,
  ArrowLeft,
  Users,
  CalendarCheck,
  UtensilsCrossed,
  XCircle,
  MessageSquare,
  Wallet,
  BarChart3,
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
import { PropertyRestaurantManager } from "@/components/dashboard/property-restaurant-manager";
import { AnalyticsPanel } from "@/components/dashboard/analytics-panel";
import { useAuth, type User } from "@/components/auth/auth-context";
import {
  getHotelsByOwner,
  createHotel,
  updateHotel,
  deleteHotel,
  getRoomsByHotel,
  addRoom,
  deleteRoom,
  setBookingRoomsStatus,
  getBookingRoomsForHotels,
  type BookingRoomRow,
} from "@/lib/hotels";
import {
  getBookingsByOwner,
  setBookingStatus,
  bookingRef,
  type BookingRow,
} from "@/lib/bookings";
import { type HotelRow, type RoomRow } from "@/lib/supabase";
import { useUnread } from "@/lib/use-unread";
import { sendEmail, bookingStatusEmail } from "@/lib/email";
import { sendBookingStatusNotification } from "@/lib/messages";
import { cn, formatPrice } from "@/lib/utils";

const AMENITY_OPTIONS = [
  "Free Wi-Fi",
  "Breakfast included",
  "Mountain views",
  "On-site restaurant",
  "Free parking",
  "24/7 room service",
  "Central heating",
  "Airport pickup",
  "Hot water",
  "Laundry",
];

type Tab =
  | "overview"
  | "hotels"
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
  { id: "hotels", label: "My Hotels", icon: Building2 },
  { id: "bookings", label: "Bookings", icon: CalendarCheck },
  { id: "payments", label: "Payments", icon: Wallet },
  { id: "restaurant", label: "Restaurant / Menu", icon: UtensilsCrossed },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "crm", label: "CRM & Insights", icon: BarChart3 },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "add", label: "Add Hotel", icon: PlusCircle },
  { id: "profile", label: "Business Profile", icon: UserRound },
];

const empty = {
  title: "",
  category_label: "Hotel",
  location: "Skardu",
  address: "",
  price: "",
  unit: "night",
  image: "",
  description: "",
  totalRooms: "",
  featured: false,
  amenities: [] as string[],
  gallery: [] as string[],
  reg_number: "",
  license_doc: "",
  owner_cnic: "",
  owner_cnic_doc: "",
  ownership_doc: "",
};

const LOCATIONS = ["Skardu", "Hunza", "Naran", "Gilgit", "Shigar", "Khaplu"];

export function HotelProviderDashboard({
  user,
  onSignOut,
}: {
  user: User;
  onSignOut: () => void;
}) {
  const [tab, setTab] = React.useState<Tab>("overview");
  const drill = useDashboardDrill();
  const [hotels, setHotels] = React.useState<HotelRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ ...empty });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [managingHotel, setManagingHotel] = React.useState<HotelRow | null>(null);
  const [bookings, setBookings] = React.useState<BookingRow[]>([]);
  const [brooms, setBrooms] = React.useState<BookingRoomRow[]>([]);
  const [chatBooking, setChatBooking] = React.useState<BookingRow | null>(null);

  const refresh = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [h, b] = await Promise.all([
      getHotelsByOwner(user.email),
      getBookingsByOwner(user.email),
    ]);
    setHotels(h);
    setBookings(b);
    setBrooms(await getBookingRoomsForHotels(h.map((x) => x.id)));
    if (!silent) setLoading(false);
  }, [user.email]);

  const pendingBookings = bookings.filter((b) => b.status === "pending").length;

  const today = new Date().toISOString().slice(0, 10);
  const inv = {
    totalRooms: hotels.reduce((s, x) => s + (x.total_rooms || 0), 0),
    reservedUnits: brooms
      .filter((x) => x.status === "pending")
      .reduce((s, x) => s + (x.units || 0), 0),
    bookedUnits: brooms
      .filter((x) => x.status === "accepted")
      .reduce((s, x) => s + (x.units || 0), 0),
    totalBookings: bookings.length,
    totalGuests: bookings
      .filter((b) => b.status === "accepted")
      .reduce((s, b) => s + (b.guests || 0), 0),
    upcomingCheckins: bookings.filter(
      (b) => b.status === "accepted" && b.check_in && b.check_in >= today
    ).length,
    upcomingCheckouts: bookings.filter(
      (b) => b.status === "accepted" && b.check_out && b.check_out >= today
    ).length,
  };
  const availableUnits = Math.max(
    0,
    inv.totalRooms - inv.reservedUnits - inv.bookedUnits
  );
  const occupancy =
    inv.totalRooms > 0
      ? Math.round(((inv.reservedUnits + inv.bookedUnits) / inv.totalRooms) * 100)
      : 0;

  const { unread, markSeen } = useUnread(
    bookings.map((b) => b.id),
    user.email,
    { sound: false }
  );

  const openChat = (b: BookingRow) => {
    markSeen(b.id);
    setChatBooking(b);
  };

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

  const handleBookingAct = async (
    id: string,
    status: "accepted" | "rejected"
  ) => {
    const b = bookings.find((x) => x.id === id);
    await setBookingStatus(id, status);
    await setBookingRoomsStatus(id, status);
    if (b) {
      sendEmail(
        b.customer_email,
        status === "accepted"
          ? "Your Rego booking is confirmed"
          : "Rego booking update",
        bookingStatusEmail({
          name: b.customer_name ?? "Guest",
          hotel: b.hotel_title,
          ref: bookingRef(b.id),
          accepted: status === "accepted",
        })
      );
      await sendBookingStatusNotification({
        booking_id: b.id,
        owner_email: user.email,
        owner_name: b.hotel_title ?? user.name,
        ref: bookingRef(b.id),
        itemTitle: b.hotel_title,
        status,
      });
    }
    await refresh();
  };

  React.useEffect(() => {
    refresh();
    const t = setInterval(() => { if (document.visibilityState === "visible") refresh(true); }, 45000);
    return () => clearInterval(t);
  }, [refresh]);

  const startEdit = (h: HotelRow) => {
    setEditingId(h.id);
    setForm({
      title: h.title,
      category_label: h.category_label,
      location: h.location,
      address: h.address ?? "",
      price: String(h.price),
      unit: h.unit,
      image: h.image ?? "",
      description: h.description ?? "",
      totalRooms: h.total_rooms != null ? String(h.total_rooms) : "",
      featured: h.featured,
      amenities: h.amenities ?? [],
      gallery: h.gallery ?? [],
      reg_number: h.reg_number ?? "",
      license_doc: h.license_doc ?? "",
      owner_cnic: h.owner_cnic ?? "",
      owner_cnic_doc: h.owner_cnic_doc ?? "",
      ownership_doc: h.ownership_doc ?? "",
    });
    setTab("add");
  };

  const resetForm = () => {
    setForm({ ...empty });
    setEditingId(null);
    setError("");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const priceNum = Number(form.price);
    if (!form.title.trim() || !priceNum) {
      setError("Please enter a hotel name and a valid price.");
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      category_label: form.category_label.trim() || "Hotel",
      location: form.location,
      address: form.address.trim() || null,
      price: priceNum,
      unit: form.unit.trim() || "night",
      image:
        form.image.trim() ||
        `https://picsum.photos/seed/hotel-resort-${
          Math.floor(Math.random() * 90) + 70
        }/900/600`,
      description: form.description.trim() || null,
      amenities: form.amenities,
      gallery: form.gallery,
      total_rooms: Number(form.totalRooms) || 0,
      reg_number: form.reg_number.trim() || null,
      license_doc: form.license_doc.trim() || null,
      owner_cnic: form.owner_cnic.trim() || null,
      owner_cnic_doc: form.owner_cnic_doc.trim() || null,
      ownership_doc: form.ownership_doc.trim() || null,
      owner_email: user.email,
    };

    const { data, error: dbError } = editingId
      ? await updateHotel(editingId, payload)
      : await createHotel(payload);

    setSaving(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    resetForm();
    await refresh();
    // New hotel → jump straight into its Rooms manager to add room types.
    if (!editingId && data) {
      setManagingHotel(data as HotelRow);
    } else {
      setTab("hotels");
    }
  };

  const remove = async (id: string) => {
    await deleteHotel(id);
    await refresh();
  };

  return (
    <div className="container-px py-10">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-3xl font-bold text-forest">
          Welcome, {user.name.split(" ")[0]}
        </h1>
        <span className="inline-flex items-center gap-1 rounded-full bg-forest-600 px-2.5 py-1 text-xs font-semibold text-white">
          <Database className="h-3.5 w-3.5" /> Saved to database
        </span>
      </div>
      <p className="mt-1 text-muted-foreground">
        Manage your hotel listings — they go live once an admin approves them.
      </p>
      <div className="mt-3">
        <ContactAdminButton ownerEmail={user.email} ownerName={user.name} ownerAvatar={user.avatar} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr] rego-dash" {...drill.gridProps}>
        <DashboardBack onClick={drill.back} />
        {/* Sidebar */}
        <aside>
          <div className="sticky top-24 rounded-3xl border border-border/70 bg-card p-3 shadow-premium">
            <div className="flex items-center gap-3 border-b border-border p-3">
              <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-gold text-forest-900">
                {user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatar}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Building2 className="h-6 w-6" />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-forest">{user.name}</p>
                <span className="mt-1 inline-block rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-gold-700">
                  Hotels &amp; Resorts · Partner
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
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      tab === n.id
                        ? "bg-gradient-forest text-white shadow-soft"
                        : "text-forest hover:bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {n.id === "add" && editingId ? "Edit Hotel" : n.label}
                    {n.id === "bookings" && pendingBookings > 0 && (
                      <span className="ml-auto rounded-full bg-gold px-2 text-[10px] font-bold text-forest-900">
                        {pendingBookings}
                      </span>
                    )}
                    {n.id === "bookings" &&
                      pendingBookings === 0 &&
                      unread.size > 0 && (
                        <span className="ml-auto h-2 w-2 rounded-full bg-red-500" />
                      )}
                  </button>
                );
              })}
              <button
                onClick={onSignOut}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-forest hover:bg-muted"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </nav>
          </div>
        </aside>

        {/* Content */}
        <div>
          {managingHotel ? (
            <RoomsManager
              hotel={managingHotel}
              onBack={() => setManagingHotel(null)}
            />
          ) : (
          <>
          {tab === "overview" && (
            <Overview
              count={hotels.length}
              loading={loading}
              onAdd={() => {
                resetForm();
                setTab("add");
              }}
              inv={inv}
              availableUnits={availableUnits}
              occupancy={occupancy}
            />
          )}

          {tab === "hotels" && (
            <MyHotels
              hotels={hotels}
              loading={loading}
              onEdit={startEdit}
              onDelete={remove}
              onManageRooms={(h) => setManagingHotel(h)}
              onAdd={() => { resetForm(); setTab("add"); }}
            />
          )}

          {tab === "add" && (
            <form
              onSubmit={save}
              className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-premium sm:p-8"
            >
              <h2 className="font-display text-xl font-bold text-forest">
                {editingId ? "Edit hotel" : "Add a new hotel"}
              </h2>
              {!editingId && (
                <p className="text-sm text-muted-foreground">
                  Add the hotel details below. After you publish, you&apos;ll add
                  your <span className="font-semibold text-forest">rooms</span>{" "}
                  (Deluxe, Standard, etc.) with prices and guest capacity.
                </p>
              )}

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
                  {error}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Hotel name" required>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Snow Peak Resort"
                    className="auth-input"
                  />
                </Field>
                <Field label="Type">
                  <input
                    value={form.category_label}
                    onChange={(e) =>
                      setForm({ ...form, category_label: e.target.value })
                    }
                    placeholder="Hotel / Resort / Heritage Hotel"
                    className="auth-input"
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
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
                <Field label="Price (PKR)" required>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="25000"
                    className="auth-input"
                  />
                </Field>
                <Field label="Per (unit)">
                  <input
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="night"
                    className="auth-input"
                  />
                </Field>
              </div>

              <Field label="Complete address">
                <input
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  placeholder="e.g. Airport Road, near Shangrila Resort, Skardu, Gilgit-Baltistan"
                  className="auth-input"
                />
              </Field>

              <Field label="Total rooms available in the property">
                <input
                  type="number"
                  value={form.totalRooms}
                  onChange={(e) =>
                    setForm({ ...form, totalRooms: e.target.value })
                  }
                  placeholder="e.g. 50"
                  className="auth-input"
                />
              </Field>

              <Field label="Description">
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Describe your hotel, rooms and facilities…"
                  className="auth-input resize-none"
                />
              </Field>

              <div>
                <span className="mb-1.5 block text-sm font-semibold text-forest">
                  Hotel photo
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
                  More photos (gallery)
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

              {/* Verification documents */}
              <div className="rounded-xl border border-border bg-forest-50/40 p-4 sm:p-5">
                <h3 className="font-display text-base font-bold text-forest">
                  Verification documents
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Submit your registration and ownership details. An admin
                  reviews these to verify your property.
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Registration / license number">
                    <input
                      value={form.reg_number}
                      onChange={(e) =>
                        setForm({ ...form, reg_number: e.target.value })
                      }
                      placeholder="e.g. GB-TOUR-2024-00123"
                      className="auth-input"
                    />
                  </Field>
                  <Field label="Owner ID (CNIC) number">
                    <input
                      value={form.owner_cnic}
                      onChange={(e) =>
                        setForm({ ...form, owner_cnic: e.target.value })
                      }
                      placeholder="e.g. 71101-1234567-1"
                      className="auth-input"
                    />
                  </Field>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-3">
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
                      onChange={(url) =>
                        setForm({ ...form, owner_cnic_doc: url })
                      }
                    />
                  </div>
                  <div>
                    <span className="mb-1.5 block text-sm font-semibold text-forest">
                      Ownership / lease proof
                    </span>
                    <ImageUpload
                      value={form.ownership_doc}
                      onChange={(url) =>
                        setForm({ ...form, ownership_doc: url })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  variant="gold"
                  size="lg"
                  className="rounded-lg"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                    </>
                  ) : editingId ? (
                    "Save changes"
                  ) : (
                    "Publish hotel"
                  )}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="rounded-lg"
                    onClick={() => { resetForm(); setTab("hotels"); }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
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

          {tab === "payments" && (
            <div className="space-y-8">
              <PaymentsManager table="bookings" bookings={bookings} onChange={refresh} senderEmail={user.email} senderName={user.name} />
              <PaymentSettings tables={["hotels"]} ownerEmail={user.email} />
            </div>
          )}

          {tab === "restaurant" && (
            <PropertyRestaurantManager
              user={user}
              propertyType="hotel"
              propertyId={hotels[0]?.id ?? null}
              propertyName={hotels[0]?.title ?? null}
            />
          )}

          {tab === "analytics" && (
            <AnalyticsPanel
              bookings={bookings}
              brooms={brooms}
              hotels={hotels}
              loading={loading}
            />
          )}

          {tab === "messages" && (
            <MessagesInbox
              bookings={bookings}
              unread={unread}
              otherLabelFor={(b) => b.customer_name ?? b.customer_email}
              onOpen={openChat}
            />
          )}

          {tab === "crm" && <OwnerCrm user={user} />}
          {tab === "profile" && <Profile user={user} />}
          </>
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

function InvCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Building2;
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-premium">
      <span
        className={cn(
          "grid h-10 w-10 place-items-center rounded-xl",
          accent ? "bg-gold/20 text-gold-700" : "bg-forest-50 text-forest-600"
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-2 font-display text-2xl font-bold text-forest">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Overview({
  count,
  loading,
  onAdd,
  inv,
  availableUnits,
  occupancy,
}: {
  count: number;
  loading: boolean;
  onAdd: () => void;
  inv: {
    totalRooms: number;
    reservedUnits: number;
    bookedUnits: number;
    totalBookings: number;
    totalGuests: number;
    upcomingCheckins: number;
    upcomingCheckouts: number;
  };
  availableUnits: number;
  occupancy: number;
}) {
  return (
    <div className="space-y-6">
      {/* Occupancy banner */}
      <div className="rounded-2xl border border-border bg-forest p-5 text-white shadow-premium">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/80">Occupancy rate</p>
            <p className="font-display text-3xl font-extrabold text-gold">
              {occupancy}%
            </p>
          </div>
          <div className="text-right text-sm text-white/80">
            <p>{count} hotel{count !== 1 ? "s" : ""}</p>
            <p>{inv.totalRooms} total rooms</p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-gold"
            style={{ width: `${occupancy}%` }}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InvCard icon={Building2} label="Total rooms" value={loading ? "…" : inv.totalRooms} />
        <InvCard icon={Database} label="Available" value={loading ? "…" : availableUnits} accent />
        <InvCard icon={CalendarCheck} label="Reserved (pending)" value={loading ? "…" : inv.reservedUnits} />
        <InvCard icon={CheckCircle2} label="Booked (confirmed)" value={loading ? "…" : inv.bookedUnits} />
        <InvCard icon={Star} label="Total bookings" value={loading ? "…" : inv.totalBookings} />
        <InvCard icon={Users} label="Guests served" value={loading ? "…" : inv.totalGuests} />
        <InvCard icon={ArrowLeft} label="Upcoming check-ins" value={loading ? "…" : inv.upcomingCheckins} />
        <InvCard icon={LogOut} label="Upcoming check-outs" value={loading ? "…" : inv.upcomingCheckouts} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-premium">
        <PlusCircle className="mx-auto h-10 w-10 text-forest-600" />
        <h2 className="mt-3 font-display text-lg font-bold text-forest">
          {count === 0 ? "Add your first hotel" : "Add another hotel"}
        </h2>
        <p className="mt-1 text-muted-foreground">
          Submit your hotel — it appears on the site once an admin approves it.
        </p>
        <Button variant="gold" className="mt-5 rounded-lg" onClick={onAdd}>
          Add hotel
        </Button>
      </div>
    </div>
  );
}

function MyHotels({
  hotels,
  loading,
  onEdit,
  onDelete,
  onManageRooms,
  onAdd,
}: {
  hotels: HotelRow[];
  loading: boolean;
  onEdit: (h: HotelRow) => void;
  onDelete: (id: string) => void;
  onManageRooms: (h: HotelRow) => void;
  onAdd: () => void;
}) {
  if (loading) {
    return (
      <div className="grid place-items-center rounded-2xl border border-border bg-card py-20 text-muted-foreground shadow-premium">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (hotels.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 py-16 text-center">
        <p className="font-display text-lg font-semibold text-forest">
          No hotels yet
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Add your hotel to publish it on the site.
        </p>
        <Button variant="gold" className="mt-5 rounded-lg" onClick={onAdd}>
          Add hotel
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {hotels.map((h) => (
        <div
          key={h.id}
          className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-premium sm:flex-row"
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
              <MapPin className="h-3.5 w-3.5" /> {h.location} · {h.category_label}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <p className="font-display font-bold text-forest">
                {formatPrice(h.price)}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  / {h.unit}
                </span>
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => onManageRooms(h)}
                  className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-forest hover:bg-muted"
                >
                  <BedDouble className="h-3.5 w-3.5" /> Rooms
                </button>
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
      <h2 className="font-display text-xl font-bold text-forest">
        Business profile
      </h2>

      <div className="flex items-center gap-4">
        <AvatarUpload
          value={user.avatar ?? ""}
          onChange={(url) => updateProfile({ avatar: url })}
        />
        <div>
          <p className="font-semibold text-forest">{user.name}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Tap the photo to upload your business logo / picture
          </p>
        </div>
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-lg border border-forest-200 bg-forest-50 px-4 py-2.5 text-sm font-medium text-forest-600">
          <CheckCircle2 className="h-4 w-4" /> Saved
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name">
          <input
            className="auth-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Email">
          <input className="auth-input" defaultValue={user.email} readOnly />
        </Field>
      </div>
      <Button type="submit" variant="gold" className="rounded-lg">
        Save changes
      </Button>
    </form>
    <AccountSecurity />
    </>
  );
}

function RoomsManager({
  hotel,
  onBack,
}: {
  hotel: HotelRow;
  onBack: () => void;
}) {
  const [rooms, setRooms] = React.useState<RoomRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [name, setName] = React.useState("");
  const [roomType, setRoomType] = React.useState("Standard");
  const [price, setPrice] = React.useState("");
  const [guests, setGuests] = React.useState("2");
  const [units, setUnits] = React.useState("1");
  const [beds, setBeds] = React.useState("1 Bed");
  const [features, setFeatures] = React.useState("");
  const [images, setImages] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setRooms(await getRoomsByHotel(hotel.id));
    setLoading(false);
  }, [hotel.id]);

  React.useEffect(() => {
    load();
  }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const priceNum = Number(price);
    if (!name.trim() || !priceNum) {
      setError("Enter a room name and a valid price.");
      return;
    }
    setSaving(true);
    const { error: dbError } = await addRoom({
      hotel_id: hotel.id,
      name: name.trim(),
      room_type: roomType,
      price: priceNum,
      guests: Number(guests) || 2,
      total_units: Number(units) || 1,
      beds: beds.trim() || "1 Bed",
      features: features
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean),
      images,
    });
    setSaving(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setName("");
    setPrice("");
    setFeatures("");
    setImages([]);
    setUnits("1");
    await load();
  };

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-forest-600 hover:text-gold"
      >
        <ArrowLeft className="h-4 w-4" /> Back to my hotels
      </button>

      <h2 className="font-display text-xl font-bold text-forest">
        Rooms — {hotel.title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Add the room types you offer. These show on your public hotel page.
      </p>

      {/* Existing rooms */}
      <div className="mt-5 space-y-3">
        {loading ? (
          <div className="grid place-items-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : rooms.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-muted/40 py-8 text-center text-sm text-muted-foreground">
            No rooms added yet.
          </p>
        ) : (
          rooms.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-premium"
            >
              <div>
                <p className="font-display font-semibold text-forest">
                  {r.name}
                  {r.room_type ? (
                    <span className="ml-2 rounded-full bg-forest-50 px-2 py-0.5 text-[10px] font-semibold text-forest-600">
                      {r.room_type}
                    </span>
                  ) : null}
                </p>
                <p className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {r.guests} guests
                  </span>
                  <span className="flex items-center gap-1">
                    <BedDouble className="h-3.5 w-3.5" /> {r.beds}
                  </span>
                  <span className="font-semibold text-forest">
                    {r.total_units ?? 1} unit{(r.total_units ?? 1) > 1 ? "s" : ""}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-display font-bold text-forest">
                  {formatPrice(r.price)}
                  <span className="text-xs font-normal text-muted-foreground">
                    {" "}
                    / night
                  </span>
                </span>
                <button
                  onClick={async () => {
                    await deleteRoom(r.id);
                    await load();
                  }}
                  className="text-red-600 hover:text-red-700"
                  aria-label="Delete room"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add room form */}
      <form
        onSubmit={add}
        className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-6 shadow-premium"
      >
        <h3 className="font-display text-base font-bold text-forest">
          Add a room
        </h3>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
            {error}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Room name" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Deluxe Room"
              className="auth-input"
            />
          </Field>
          <Field label="Price per night (PKR)" required>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="12000"
              className="auth-input"
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Room type">
            <select
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
              className="auth-input"
            >
              {["Standard", "Deluxe", "Suite", "Executive", "Family", "Dormitory"].map(
                (t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                )
              )}
            </select>
          </Field>
          <Field label="Max guests">
            <input
              type="number"
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
              className="auth-input"
            />
          </Field>
          <Field label="Total units" required>
            <input
              type="number"
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              placeholder="e.g. 5"
              className="auth-input"
            />
          </Field>
        </div>
        <Field label="Beds">
          <input
            value={beds}
            onChange={(e) => setBeds(e.target.value)}
            placeholder="1 King bed"
            className="auth-input"
          />
        </Field>
        <Field label="Features (comma separated)">
          <input
            value={features}
            onChange={(e) => setFeatures(e.target.value)}
            placeholder="Mountain view, Breakfast, Balcony"
            className="auth-input"
          />
        </Field>
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-forest">
            Room photos
          </span>
          <MultiImageUpload value={images} onChange={setImages} />
        </div>
        <Button
          type="submit"
          variant="gold"
          className="rounded-lg"
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Adding…
            </>
          ) : (
            "Add room"
          )}
        </Button>
      </form>
    </div>
  );
}

function BookingsPanel({
  bookings,
  loading,
  onAct,
  onChat,
  unread,
}: {
  bookings: BookingRow[];
  loading: boolean;
  onAct: (id: string, status: "accepted" | "rejected") => void;
  onChat: (b: BookingRow) => void;
  unread: Set<string>;
}) {
  if (loading) {
    return (
      <div className="grid place-items-center rounded-2xl border border-border bg-card py-20 text-muted-foreground shadow-premium">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (bookings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 py-16 text-center">
        <CalendarCheck className="mx-auto h-10 w-10 text-forest-600" />
        <p className="mt-2 font-display text-lg font-semibold text-forest">
          No booking requests yet
        </p>
        <p className="text-sm text-muted-foreground">
          When customers book your hotels, requests appear here.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {bookings.map((b) => (
        <div
          key={b.id}
          className="rounded-2xl border border-border bg-card p-5 shadow-premium"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-xs font-bold tracking-wider text-forest-600">
                {bookingRef(b.id)}
              </p>
              <p className="font-display text-base font-semibold text-forest">
                {b.hotel_title}
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

          {/* Customer details */}
          <div className="mt-3 grid gap-2 rounded-xl bg-forest-50/50 p-3 text-sm sm:grid-cols-2">
            <Detail label="Customer" value={b.customer_name ?? "—"} />
            <Detail label="From (city)" value={b.customer_city ?? "—"} />
            <Detail label="Phone" value={b.customer_phone ?? "—"} />
            <Detail label="Email" value={b.customer_email} />
            <Detail
              label="Check-in"
              value={b.check_in ?? "—"}
            />
            <Detail
              label="Check-out"
              value={b.check_out ?? "—"}
            />
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
                  className="flex items-center gap-1.5 rounded-lg bg-forest-600 px-3 py-2 text-sm font-semibold text-white hover:bg-forest-700"
                >
                  <CheckCircle2 className="h-4 w-4" /> Accept
                </button>
                <button
                  onClick={() => onAct(b.id, "rejected")}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4" /> Reject
                </button>
              </>
            )}
            <button
              onClick={() => onChat(b)}
              className={cn(
                "relative flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
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
