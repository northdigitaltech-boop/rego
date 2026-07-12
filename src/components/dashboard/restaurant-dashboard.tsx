"use client";

import * as React from "react";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ListChecks,
  CalendarCheck,
  MessageSquare,
  Star,
  BarChart3,
  Wallet,
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
import { ImageUpload, MultiImageUpload, AvatarUpload } from "@/components/ui/image-upload";
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
  getRestaurantByOwner,
  createRestaurant,
  updateRestaurant,
  getMenuByRestaurant,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  CUISINE_TYPES,
  DINING_OPTIONS,
  RESTAURANT_FACILITIES,
  PRICE_RANGES,
  MENU_CATEGORIES,
  SPICY_LEVELS,
  type RestaurantRow,
  type MenuItemRow,
} from "@/lib/restaurants";
import {
  getRestaurantBookingsByOwner,
  setRestaurantBookingStatus,
  restaurantBookingRef,
  type RestaurantBookingRow,
} from "@/lib/restaurant-bookings";
import { RestaurantDetail } from "@/components/listings/restaurant-detail";
import { sendEmail, bookingStatusEmail } from "@/lib/email";
import { sendBookingStatusNotification } from "@/lib/messages";
import { cn, formatPrice } from "@/lib/utils";

const splitList = (s: string) => s.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean);
const joinList = (a: string[] | null | undefined) => (a ?? []).join(", ");
const num = (v: string) => {
  const n = Number(v);
  return v.trim() && !Number.isNaN(n) ? n : null;
};

type Tab = "overview" | "profile" | "menu" | "bookings" | "payments" | "messages" | "reviews" | "analytics" | "crm";
const nav: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: Eye },
  { id: "profile", label: "Restaurant Profile", icon: UtensilsCrossed },
  { id: "menu", label: "Manage Menu", icon: ListChecks },
  { id: "bookings", label: "Bookings & Inquiries", icon: CalendarCheck },
  { id: "payments", label: "Payments", icon: Wallet },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "reviews", label: "Reviews", icon: Star },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "crm", label: "CRM & Insights", icon: BarChart3 },
];

export function RestaurantDashboard({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [tab, setTab] = React.useState<Tab>("profile");
  const [restaurant, setRestaurant] = React.useState<RestaurantRow | null>(null);
  const [menu, setMenu] = React.useState<MenuItemRow[]>([]);
  const [bookings, setBookings] = React.useState<RestaurantBookingRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [chatBooking, setChatBooking] = React.useState<BookingRow | null>(null);

  const refresh = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const r = await getRestaurantByOwner(user.email);
    setRestaurant(r);
    if (r) {
      const [m, b] = await Promise.all([
        getMenuByRestaurant(r.id),
        getRestaurantBookingsByOwner(user.email),
      ]);
      setMenu(m);
      setBookings(b);
    }
    if (!silent) setLoading(false);
  }, [user.email]);

  React.useEffect(() => {
    refresh();
    // Background poll must be silent so it never unmounts a form being filled.
    const t = setInterval(() => { if (document.visibilityState === "visible") refresh(true); }, 45000);
    return () => clearInterval(t);
  }, [refresh]);

  const toRow = (b: RestaurantBookingRow): BookingRow =>
    ({
      ...b,
      hotel_id: b.restaurant_id,
      hotel_title: b.item_title,
      room_name: b.booking_type === "inquiry" ? "Food inquiry" : "Table booking",
      check_in: b.date,
      check_out: null,
      rooms: 1,
    }) as unknown as BookingRow;
  const bookingRows = bookings.map(toRow);
  const { unread, markSeen } = useUnread(bookings.map((b) => b.id), user.email, { sound: false });
  const openChatRow = (r: BookingRow) => { markSeen(r.id); setChatBooking(r); };
  const openChat = (b: RestaurantBookingRow) => openChatRow(toRow(b));

  React.useEffect(() => {
    const tryOpen = (id: string | null) => {
      if (!id) return;
      const b = bookings.find((x) => x.id === id);
      if (b) {
        try { localStorage.removeItem("safarigb_open_chat"); } catch { /* ignore */ }
        openChat(b);
      }
    };
    try { tryOpen(localStorage.getItem("safarigb_open_chat")); } catch { /* ignore */ }
    const handler = (e: Event) => tryOpen((e as CustomEvent<string>).detail);
    window.addEventListener("safarigb:open-chat", handler);
    return () => window.removeEventListener("safarigb:open-chat", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings]);

  const pendingBookings = bookings.filter((b) => b.status === "pending").length;

  const handleBookingAct = async (id: string, status: "accepted" | "rejected") => {
    const b = bookings.find((x) => x.id === id);
    await setRestaurantBookingStatus(id, status);
    if (b) {
      sendEmail(
        b.customer_email,
        status === "accepted" ? "Your Rego table booking is confirmed" : "Rego booking update",
        bookingStatusEmail({ name: b.customer_name ?? "Guest", hotel: b.item_title, ref: restaurantBookingRef(b.id), accepted: status === "accepted" })
      );
      await sendBookingStatusNotification({
        booking_id: b.id,
        owner_email: user.email,
        owner_name: restaurant?.name ?? user.name,
        ref: restaurantBookingRef(b.id),
        itemTitle: b.item_title,
        status,
      });
    }
    await refresh();
  };

  if (loading) {
    return <div className="container-px py-24 text-center text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;
  }

  if (!restaurant) {
    return (
      <div className="container-px py-10">
        <h1 className="font-display text-3xl font-bold text-forest">Welcome, {user.name.split(" ")[0]}</h1>
        <p className="mt-1 text-muted-foreground">Create your restaurant profile to start adding your menu and taking table bookings.</p>
        <div className="mt-8 max-w-3xl"><RestaurantForm user={user} restaurant={null} onSaved={refresh} /></div>
      </div>
    );
  }

  return (
    <div className="container-px py-10">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-3xl font-bold text-forest">{restaurant.name}</h1>
        <StatusBadge status={restaurant.status} />
        {restaurant.verified && (
          <span className="inline-flex items-center gap-1 rounded-full bg-forest-600 px-2.5 py-1 text-xs font-semibold text-white"><CheckCircle2 className="h-3.5 w-3.5" /> Verified</span>
        )}
        {(restaurant as { pending_changes?: unknown }).pending_changes != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2.5 py-1 text-xs font-semibold text-gold-700">Edits pending admin review</span>
        )}
      </div>
      <p className="mt-1 text-muted-foreground">Manage your profile, menu and bookings — your restaurant goes live once an admin approves it.</p>
      <div className="mt-3"><ContactAdminButton ownerEmail={user.email} ownerName={user.name} ownerAvatar={user.avatar} /></div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside>
          <div className="sticky top-24 rounded-3xl border border-border/70 bg-card p-3 shadow-premium">
            <div className="flex items-center gap-3 border-b border-border p-3">
              <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-gradient-gold text-forest-900">
                {restaurant.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={restaurant.logo} alt="" className="h-full w-full object-cover" />
                ) : (<UtensilsCrossed className="h-6 w-6" />)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-forest">{user.name}</p>
                <span className="mt-1 inline-block rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-gold-700">Restaurant · Partner</span>
              </div>
            </div>
            <nav className="mt-2 space-y-1">
              {nav.map((n) => {
                const Icon = n.icon;
                return (
                  <button key={n.id} onClick={() => setTab(n.id)} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all", tab === n.id ? "bg-gradient-forest text-white shadow-soft" : "text-forest hover:bg-muted")}>
                    <Icon className="h-4 w-4" />
                    {n.label}
                    {n.id === "bookings" && pendingBookings > 0 && (<span className="ml-auto rounded-full bg-gold px-2 text-[10px] font-bold text-forest-900">{pendingBookings}</span>)}
                    {n.id === "messages" && unread.size > 0 && (<span className="ml-auto rounded-full bg-red-500 px-2 text-[10px] font-bold text-white">{unread.size}</span>)}
                  </button>
                );
              })}
              <button onClick={onSignOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-forest hover:bg-muted"><LogOut className="h-4 w-4" /> Sign out</button>
            </nav>
          </div>
        </aside>

        <div>
          {tab === "overview" && (
            <div>
              <div className="mb-4 rounded-xl border border-forest-200 bg-forest-50/60 px-4 py-3 text-sm text-forest-600">
                This is exactly how customers see your restaurant page.
              </div>
              <div className="overflow-hidden rounded-3xl border border-border/70 shadow-premium">
                <RestaurantDetail restaurant={restaurant} menu={menu} />
              </div>
            </div>
          )}
          {tab === "crm" && <OwnerCrm user={user} />}
          {tab === "profile" && (<><RestaurantForm user={user} restaurant={restaurant} onSaved={refresh} /><AccountSecurity /></>)}
          {tab === "menu" && <MenuManager restaurant={restaurant} user={user} items={menu} onChange={refresh} />}
          {tab === "bookings" && <BookingsPanel bookings={bookings} onAct={handleBookingAct} onChat={openChat} unread={unread} />}
          {tab === "payments" && (
            <div className="space-y-8">
              <PaymentsManager table="restaurant_bookings" bookings={bookings} onChange={refresh} senderEmail={user.email} senderName={user.name} />
              <PaymentSettings tables={["restaurants"]} ownerEmail={user.email} />
            </div>
          )}
          {tab === "messages" && (
            <MessagesInbox bookings={bookingRows} unread={unread} otherLabelFor={(b) => b.customer_name ?? b.customer_email} onOpen={openChatRow} />
          )}
          {tab === "reviews" && <ReviewsPanel restaurant={restaurant} />}
          {tab === "analytics" && <AnalyticsPanel restaurant={restaurant} menu={menu} bookings={bookings} />}
        </div>
      </div>

      {chatBooking && (
        <ChatModal booking={chatBooking} currentEmail={user.email} currentName={user.name} currentAvatar={user.avatar} otherLabel={chatBooking.customer_name ?? chatBooking.customer_email} onSeen={() => markSeen(chatBooking.id)} onClose={() => setChatBooking(null)} />
      )}
    </div>
  );
}

/* ============================================================ Profile form ============================================================ */

function RestaurantForm({ user, restaurant, onSaved }: { user: User; restaurant: RestaurantRow | null; onSaved: () => void }) {
  const editing = !!restaurant;
  const [f, setF] = React.useState({
    name: restaurant?.name ?? "",
    owner_name: restaurant?.owner_name ?? user.name,
    logo: restaurant?.logo ?? "",
    cover_image: restaurant?.cover_image ?? "",
    gallery: restaurant?.gallery ?? [],
    phone: restaurant?.phone ?? "",
    whatsapp: restaurant?.whatsapp ?? "",
    email: restaurant?.email ?? user.email,
    address: restaurant?.address ?? "",
    map_link: restaurant?.map_link ?? "",
    city: restaurant?.city ?? "",
    location: restaurant?.location ?? "Gilgit",
    opening_hours: restaurant?.opening_hours ?? "",
    closing_hours: restaurant?.closing_hours ?? "",
    cuisine_types: restaurant?.cuisine_types ?? ([] as string[]),
    dining_options: restaurant?.dining_options ?? ([] as string[]),
    price_range: restaurant?.price_range ?? "Mid-range",
    description: restaurant?.description ?? "",
    facilities: restaurant?.facilities ?? ([] as string[]),
    social_links: joinList(restaurant?.social_links),
    license_doc: restaurant?.license_doc ?? "",
    owner_cnic: restaurant?.owner_cnic ?? "",
    owner_cnic_doc: restaurant?.owner_cnic_doc ?? "",
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saved, setSaved] = React.useState(false);
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  const toggle = (key: "cuisine_types" | "dining_options" | "facilities", val: string) =>
    setF((x) => ({ ...x, [key]: x[key].includes(val) ? x[key].filter((v) => v !== val) : [...x[key], val] }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!f.name.trim()) { setError("Please enter your restaurant name."); return; }
    setSaving(true);
    const payload = {
      name: f.name.trim(),
      owner_name: f.owner_name.trim() || null,
      logo: f.logo.trim() || null,
      cover_image: f.cover_image.trim() || null,
      gallery: f.gallery,
      phone: f.phone.trim() || null,
      whatsapp: f.whatsapp.trim() || null,
      email: f.email.trim() || null,
      address: f.address.trim() || null,
      map_link: f.map_link.trim() || null,
      city: f.city.trim() || null,
      location: f.location.trim() || null,
      opening_hours: f.opening_hours.trim() || null,
      closing_hours: f.closing_hours.trim() || null,
      cuisine_types: f.cuisine_types,
      dining_options: f.dining_options,
      price_range: f.price_range,
      description: f.description.trim() || null,
      facilities: f.facilities,
      social_links: splitList(f.social_links),
      license_doc: f.license_doc.trim() || null,
      owner_cnic: f.owner_cnic.trim() || null,
      owner_cnic_doc: f.owner_cnic_doc.trim() || null,
      owner_email: user.email,
    };
    const { error: dbError } = editing ? await updateRestaurant(restaurant!.id, payload) : await createRestaurant(payload);
    setSaving(false);
    if (dbError) { setError(dbError.message); return; }
    setSaved(true);
    onSaved();
  };

  return (
    <form onSubmit={save} className="space-y-6 rounded-3xl border border-border/70 bg-card p-6 shadow-premium sm:p-8">
      <div>
        <h2 className="font-display text-xl font-bold text-forest">{editing ? "Restaurant profile" : "Create your restaurant profile"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">This profile powers your public page. It goes live once an admin approves it.</p>
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
      {saved && (<div className="flex items-center gap-2 rounded-lg border border-forest-200 bg-forest-50 px-4 py-2.5 text-sm font-medium text-forest-600"><CheckCircle2 className="h-4 w-4" /> Saved</div>)}

      <SectionTitle>Basics</SectionTitle>
      <div className="flex items-center gap-4">
        <AvatarUpload value={f.logo} onChange={(url) => set({ logo: url })} />
        <div className="flex-1">
          <Field label="Restaurant name" required><input value={f.name} onChange={(e) => set({ name: e.target.value })} className="auth-input" /></Field>
        </div>
      </div>
      <div>
        <span className="mb-1.5 block text-sm font-semibold text-forest">Cover image</span>
        <ImageUpload value={f.cover_image} onChange={(url) => set({ cover_image: url })} />
      </div>
      <div>
        <span className="mb-1.5 block text-sm font-semibold text-forest">Gallery images</span>
        <MultiImageUpload value={f.gallery} onChange={(urls) => set({ gallery: urls })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Owner / manager name"><input value={f.owner_name} onChange={(e) => set({ owner_name: e.target.value })} className="auth-input" /></Field>
        <Field label="Price range">
          <select value={f.price_range} onChange={(e) => set({ price_range: e.target.value })} className="auth-input">
            {PRICE_RANGES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Description (short)"><input value={f.description} onChange={(e) => set({ description: e.target.value })} className="auth-input" /></Field>
      </div>

      <SectionTitle>Contact &amp; location</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Phone"><input value={f.phone} onChange={(e) => set({ phone: e.target.value })} className="auth-input" placeholder="+92 3xx…" /></Field>
        <Field label="WhatsApp"><input value={f.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} className="auth-input" placeholder="+92 3xx…" /></Field>
        <Field label="Email"><input value={f.email} onChange={(e) => set({ email: e.target.value })} className="auth-input" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="City / district"><input value={f.city} onChange={(e) => set({ city: e.target.value })} className="auth-input" placeholder="Skardu" /></Field>
        <Field label="Base location"><input value={f.location} onChange={(e) => set({ location: e.target.value })} className="auth-input" /></Field>
        <Field label="Map link"><input value={f.map_link} onChange={(e) => set({ map_link: e.target.value })} className="auth-input" placeholder="https://maps…" /></Field>
      </div>
      <Field label="Address"><input value={f.address} onChange={(e) => set({ address: e.target.value })} className="auth-input" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Opening hours"><input value={f.opening_hours} onChange={(e) => set({ opening_hours: e.target.value })} className="auth-input" placeholder="9:00 AM" /></Field>
        <Field label="Closing hours"><input value={f.closing_hours} onChange={(e) => set({ closing_hours: e.target.value })} className="auth-input" placeholder="11:00 PM" /></Field>
      </div>

      <SectionTitle>Cuisine &amp; dining</SectionTitle>
      <CheckGroup label="Cuisine type" options={CUISINE_TYPES} selected={f.cuisine_types} onToggle={(v) => toggle("cuisine_types", v)} />
      <CheckGroup label="Dining options" options={DINING_OPTIONS} selected={f.dining_options} onToggle={(v) => toggle("dining_options", v)} />
      <CheckGroup label="Facilities" options={RESTAURANT_FACILITIES} selected={f.facilities} onToggle={(v) => toggle("facilities", v)} />
      <Field label="Social media links (comma separated)"><input value={f.social_links} onChange={(e) => set({ social_links: e.target.value })} className="auth-input" /></Field>

      <SectionTitle>Verification documents</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Owner ID (CNIC) number"><input value={f.owner_cnic} onChange={(e) => set({ owner_cnic: e.target.value })} className="auth-input" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-forest">Food safety / license</span>
          <ImageUpload value={f.license_doc} onChange={(url) => set({ license_doc: url })} />
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-forest">Owner ID photo</span>
          <ImageUpload value={f.owner_cnic_doc} onChange={(url) => set({ owner_cnic_doc: url })} />
        </div>
      </div>

      <Button type="submit" variant="gold" size="lg" className="rounded-lg" disabled={saving}>
        {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : editing ? "Save changes" : "Create restaurant"}
      </Button>
    </form>
  );
}

/* ============================================================ Menu manager ============================================================ */

function MenuManager({ restaurant, user, items, onChange }: { restaurant: RestaurantRow; user: User; items: MenuItemRow[]; onChange: () => void }) {
  const [editing, setEditing] = React.useState<MenuItemRow | null>(null);
  const [adding, setAdding] = React.useState(false);

  if (adding || editing) {
    return <MenuForm restaurant={restaurant} user={user} item={editing} onDone={() => { setAdding(false); setEditing(null); onChange(); }} onCancel={() => { setAdding(false); setEditing(null); }} />;
  }
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-forest">Manage Menu</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">Add your dishes — they appear as image cards on your public page.</p>
        </div>
        <Button variant="gold" className="rounded-lg" onClick={() => setAdding(true)}><PlusCircle className="h-4 w-4" /> Add menu item</Button>
      </div>
      {items.length === 0 ? (
        <div className="mt-5 rounded-3xl border border-dashed border-border bg-muted/40 py-14 text-center text-sm text-muted-foreground">No menu items yet.</div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((m) => (
            <div key={m.id} className="group overflow-hidden rounded-2xl border border-border/70 bg-card shadow-premium transition-all duration-300 hover:-translate-y-1 hover:shadow-premium-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.image || "https://picsum.photos/seed/food/600/400"} alt={m.name} className="h-32 w-full object-cover transition-transform duration-500 group-hover:scale-110" />
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-sm font-semibold text-forest">{m.name}</h3>
                  <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold uppercase", m.availability === "available" ? "bg-forest-50 text-forest-600" : "bg-red-50 text-red-600")}>{m.availability}</span>
                </div>
                {m.category && <p className="text-[11px] text-muted-foreground">{m.category}</p>}
                <div className="mt-1.5 flex items-center gap-2">
                  {m.discount_price != null ? (
                    <>
                      <span className="font-display font-bold text-forest">{formatPrice(m.discount_price)}</span>
                      <span className="text-xs text-muted-foreground line-through">{formatPrice(m.price)}</span>
                    </>
                  ) : (
                    <span className="font-display font-bold text-forest">{formatPrice(m.price)}</span>
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => setEditing(m)} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs font-medium text-forest hover:bg-muted"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                  <button onClick={async () => { await deleteMenuItem(m.id); onChange(); }} className="flex items-center justify-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MenuForm({ restaurant, user, item, onDone, onCancel }: { restaurant: RestaurantRow; user: User; item: MenuItemRow | null; onDone: () => void; onCancel: () => void }) {
  const editing = !!item;
  const [f, setF] = React.useState({
    name: item?.name ?? "",
    category: item?.category ?? MENU_CATEGORIES[0],
    image: item?.image ?? "",
    description: item?.description ?? "",
    price: item?.price ? String(item.price) : "",
    discount_price: item?.discount_price ? String(item.discount_price) : "",
    prep_time: item?.prep_time ?? "",
    serving_size: item?.serving_size ?? "",
    availability: item?.availability ?? "available",
    featured: item?.featured ?? false,
    spicy_level: item?.spicy_level ?? "Mild",
    vegetarian: item?.vegetarian ?? false,
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!f.name.trim() || !Number(f.price)) { setError("Please enter an item name and a valid price."); return; }
    setSaving(true);
    const payload = {
      restaurant_id: restaurant.id,
      name: f.name.trim(),
      category: f.category,
      image: f.image.trim() || `https://picsum.photos/seed/food-${Math.floor(Math.random() * 90) + 10}/600/400`,
      description: f.description.trim() || null,
      price: Number(f.price),
      discount_price: num(f.discount_price),
      prep_time: f.prep_time.trim() || null,
      serving_size: f.serving_size.trim() || null,
      availability: f.availability,
      featured: f.featured,
      spicy_level: f.spicy_level,
      vegetarian: f.vegetarian,
      owner_email: user.email,
    };
    const { error: dbError } = editing ? await updateMenuItem(item!.id, payload) : await createMenuItem(payload);
    setSaving(false);
    if (dbError) { setError(dbError.message); return; }
    onDone();
  };

  return (
    <form onSubmit={save} className="space-y-5 rounded-3xl border border-border/70 bg-card p-6 shadow-premium sm:p-8">
      <FormHeader title={editing ? "Edit menu item" : "Add menu item"} onCancel={onCancel} />
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Item name" required><input value={f.name} onChange={(e) => set({ name: e.target.value })} className="auth-input" placeholder="e.g. Chapli Kebab" /></Field>
        <Field label="Category">
          <select value={f.category} onChange={(e) => set({ category: e.target.value })} className="auth-input">
            {MENU_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <div>
        <span className="mb-1.5 block text-sm font-semibold text-forest">Item image</span>
        <ImageUpload value={f.image} onChange={(url) => set({ image: url })} />
      </div>
      <Field label="Short description"><textarea rows={2} value={f.description} onChange={(e) => set({ description: e.target.value })} className="auth-input resize-none" /></Field>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Price (PKR)" required><input type="number" value={f.price} onChange={(e) => set({ price: e.target.value })} className="auth-input" /></Field>
        <Field label="Discount price"><input type="number" value={f.discount_price} onChange={(e) => set({ discount_price: e.target.value })} className="auth-input" /></Field>
        <Field label="Prep time"><input value={f.prep_time} onChange={(e) => set({ prep_time: e.target.value })} className="auth-input" placeholder="15 min" /></Field>
        <Field label="Serving size"><input value={f.serving_size} onChange={(e) => set({ serving_size: e.target.value })} className="auth-input" placeholder="1 plate" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Availability">
          <select value={f.availability} onChange={(e) => set({ availability: e.target.value })} className="auth-input">
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </Field>
        <Field label="Spicy level">
          <select value={f.spicy_level} onChange={(e) => set({ spicy_level: e.target.value })} className="auth-input">
            {SPICY_LEVELS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <div className="flex items-end gap-4 pb-3">
          <label className="flex items-center gap-2 text-sm font-medium text-forest"><input type="checkbox" checked={f.featured} onChange={(e) => set({ featured: e.target.checked })} className="h-4 w-4 accent-forest-600" /> Featured</label>
          <label className="flex items-center gap-2 text-sm font-medium text-forest"><input type="checkbox" checked={f.vegetarian} onChange={(e) => set({ vegetarian: e.target.checked })} className="h-4 w-4 accent-forest-600" /> Veg</label>
        </div>
      </div>
      <SaveButtons saving={saving} editing={editing} onCancel={onCancel} />
    </form>
  );
}

/* ============================================================ Bookings / Reviews / Analytics ============================================================ */

function BookingsPanel({ bookings, onAct, onChat, unread }: { bookings: RestaurantBookingRow[]; onAct: (id: string, status: "accepted" | "rejected") => void; onChat: (b: RestaurantBookingRow) => void; unread: Set<string> }) {
  if (bookings.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-muted/40 py-16 text-center">
        <CalendarCheck className="mx-auto h-10 w-10 text-forest-600" />
        <p className="mt-2 font-display text-lg font-semibold text-forest">No bookings or inquiries yet</p>
        <p className="text-sm text-muted-foreground">Table bookings and food inquiries appear here.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {bookings.map((b) => (
        <div key={b.id} className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-xs font-bold tracking-wider text-forest-600">{restaurantBookingRef(b.id)} · {b.booking_type === "inquiry" ? "Food Inquiry" : "Table Booking"}</p>
              <p className="font-display text-base font-semibold text-forest">{b.item_title}</p>
              <p className="text-sm font-semibold text-forest">{b.guests} guest{b.guests > 1 ? "s" : ""}</p>
            </div>
            {b.status !== "pending" && <BookingStatusBadge status={b.status} />}
          </div>
          <div className="mt-3 grid gap-2 rounded-xl bg-forest-50/50 p-3 text-sm sm:grid-cols-2">
            <KV k="Customer" v={b.customer_name ?? "—"} />
            <KV k="Phone" v={b.customer_phone ?? "—"} />
            <KV k="Date" v={b.date ?? "—"} />
            <KV k="Time" v={b.time ?? "—"} />
          </div>
          {b.notes && <p className="mt-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-forest"><span className="font-semibold">Note:</span> {b.notes}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {b.status === "pending" && (
              <>
                <button onClick={() => onAct(b.id, "accepted")} className="flex items-center gap-1.5 rounded-xl bg-gradient-forest px-3.5 py-2 text-sm font-semibold text-white shadow-soft hover:-translate-y-0.5"><CheckCircle2 className="h-4 w-4" /> Accept</button>
                <button onClick={() => onAct(b.id, "rejected")} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"><XCircle className="h-4 w-4" /> Reject</button>
              </>
            )}
            <button onClick={() => onChat(b)} className={cn("relative flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors", unread.has(b.id) ? "border-red-300 bg-red-50 text-red-600" : "border-border text-forest hover:bg-muted")}>
              <MessageSquare className="h-4 w-4" /> Message
              {unread.has(b.id) && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500" />}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewsPanel({ restaurant }: { restaurant: RestaurantRow }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-premium">
      <div className="flex items-center gap-3">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-forest text-gold"><Star className="h-6 w-6 fill-gold" /></span>
        <div>
          <p className="font-display text-3xl font-extrabold text-forest">{Number(restaurant.rating || 0).toFixed(1)}</p>
          <p className="text-sm text-muted-foreground">{restaurant.reviews} review{restaurant.reviews === 1 ? "" : "s"}</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Only diners with a confirmed booking can leave a review, so every rating is from a real customer.</p>
    </div>
  );
}

function AnalyticsPanel({ restaurant, menu, bookings }: { restaurant: RestaurantRow; menu: MenuItemRow[]; bookings: RestaurantBookingRow[] }) {
  const accepted = bookings.filter((b) => b.status === "accepted").length;
  const pending = bookings.filter((b) => b.status === "pending").length;
  const rejected = bookings.filter((b) => b.status === "rejected").length;
  const months: { label: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const key = d.toISOString().slice(0, 7);
    months.push({ label: d.toLocaleString("default", { month: "short" }), count: bookings.filter((b) => b.created_at?.slice(0, 7) === key).length });
  }
  const max = Math.max(1, ...months.map((m) => m.count));
  const featured = menu.filter((m) => m.featured).slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={ListChecks} label="Menu items" value={menu.length} accent />
        <Stat icon={CalendarCheck} label="Total bookings" value={bookings.length} />
        <Stat icon={Database} label="Pending" value={pending} />
        <Stat icon={CheckCircle2} label="Confirmed" value={accepted} />
        <Stat icon={XCircle} label="Cancelled" value={rejected} />
        <Stat icon={Eye} label="Menu views" value={restaurant.menu_views} />
        <Stat icon={Star} label="Rating" value={Number(restaurant.rating || 0).toFixed(1)} />
        <Stat icon={Star} label="Reviews" value={restaurant.reviews} />
      </div>
      <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><TrendingUp className="h-4 w-4 text-forest-600" /> Monthly bookings</p>
        <div className="mt-4 flex items-end gap-3" style={{ height: 140 }}>
          {months.map((m) => (
            <div key={m.label} className="flex flex-1 flex-col items-center justify-end gap-2">
              <span className="text-xs font-bold text-forest">{m.count}</span>
              <div className="w-full rounded-t-lg bg-gradient-forest" style={{ height: `${(m.count / max) * 100}%`, minHeight: m.count ? 6 : 2 }} />
              <span className="text-xs text-muted-foreground">{m.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
        <p className="text-sm text-muted-foreground">Popular / featured items</p>
        {featured.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Mark items as featured to highlight them.</p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {featured.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm">
                <span className="font-medium text-forest">{m.name}</span>
                <span className="text-muted-foreground">{formatPrice(m.discount_price ?? m.price)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================ Shared bits ============================================================ */

function CheckGroup({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-semibold text-forest">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = selected.includes(o);
          return (
            <button type="button" key={o} onClick={() => onToggle(o)} className={cn("rounded-full px-3 py-1.5 text-xs font-semibold transition-colors", active ? "bg-gradient-forest text-white shadow-soft" : "border border-border bg-card text-forest hover:bg-muted")}>{o}</button>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: typeof Star; label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card p-4 shadow-premium">
      <span className={cn("grid h-11 w-11 place-items-center rounded-2xl", accent ? "bg-gradient-gold text-forest-900" : "bg-gradient-forest text-gold")}><Icon className="h-5 w-5" /></span>
      <p className="mt-3 font-display text-2xl font-bold text-forest">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-border pb-2"><h3 className="font-display text-base font-bold text-forest">{children}</h3></div>;
}
function FormHeader({ title, onCancel }: { title: string; onCancel: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="font-display text-xl font-bold text-forest">{title}</h2>
      <button type="button" onClick={onCancel} className="text-sm font-medium text-forest-600 hover:text-gold">← Back</button>
    </div>
  );
}
function SaveButtons({ saving, editing, onCancel }: { saving: boolean; editing: boolean; onCancel: () => void }) {
  return (
    <div className="flex gap-2">
      <Button type="submit" variant="gold" size="lg" className="rounded-lg" disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : editing ? "Save changes" : "Publish"}</Button>
      <Button type="button" variant="outline" size="lg" className="rounded-lg" onClick={onCancel}>Cancel</Button>
    </div>
  );
}
function ErrorBox({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">{children}</div>;
}
function KV({ k, v }: { k: string; v: string }) {
  return <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</p><p className="font-medium text-forest">{v}</p></div>;
}
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-forest">{label} {required && <span className="text-gold-600">*</span>}</span>
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
