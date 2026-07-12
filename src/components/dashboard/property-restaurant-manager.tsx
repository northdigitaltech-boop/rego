"use client";

import * as React from "react";
import {
  Loader2,
  PlusCircle,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  MessageSquare,
  CalendarCheck,
  UtensilsCrossed,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ImageUpload, MultiImageUpload, AvatarUpload } from "@/components/ui/image-upload";
import { ChatModal } from "@/components/chat/chat-modal";
import { useUnread } from "@/lib/use-unread";
import { type User } from "@/components/auth/auth-context";
import { type BookingRow } from "@/lib/bookings";
import {
  getPropertyRestaurantByOwner,
  createRestaurant,
  updateRestaurant,
  getMenuByRestaurant,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  CUISINE_TYPES,
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
import { sendBookingStatusNotification } from "@/lib/messages";
import { cn, formatPrice } from "@/lib/utils";

const num = (v: string) => {
  const n = Number(v);
  return v.trim() && !Number.isNaN(n) ? n : null;
};

/**
 * Lets a hotel / homestay run an in-house restaurant: a property-linked
 * restaurant profile + full menu + table bookings, reusing the restaurant
 * module. Self-contained so it drops into either dashboard.
 */
export function PropertyRestaurantManager({
  user,
  propertyType,
  propertyId,
  propertyName,
}: {
  user: User;
  propertyType: "hotel" | "homestay" | "hostel";
  propertyId: string | null;
  propertyName: string | null;
}) {
  const [restaurant, setRestaurant] = React.useState<RestaurantRow | null>(null);
  const [menu, setMenu] = React.useState<MenuItemRow[]>([]);
  const [bookings, setBookings] = React.useState<RestaurantBookingRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [view, setView] = React.useState<"profile" | "menu" | "bookings">("menu");
  const [chatBooking, setChatBooking] = React.useState<BookingRow | null>(null);

  const refresh = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const r = await getPropertyRestaurantByOwner(user.email);
    setRestaurant(r);
    if (r) {
      const [m, b] = await Promise.all([
        getMenuByRestaurant(r.id),
        getRestaurantBookingsByOwner(user.email),
      ]);
      setMenu(m);
      setBookings(b.filter((x) => x.restaurant_id === r.id));
    }
    if (!silent) setLoading(false);
  }, [user.email]);

  React.useEffect(() => { refresh(); }, [refresh]);

  const toRow = (b: RestaurantBookingRow): BookingRow =>
    ({ ...b, hotel_id: b.restaurant_id, hotel_title: b.item_title, room_name: b.booking_type === "inquiry" ? "Food inquiry" : "Table booking", check_in: b.date, check_out: null, rooms: 1 }) as unknown as BookingRow;
  const { unread, markSeen } = useUnread(bookings.map((b) => b.id), user.email, { sound: false });

  const act = async (id: string, status: "accepted" | "rejected") => {
    const b = bookings.find((x) => x.id === id);
    await setRestaurantBookingStatus(id, status);
    if (b) {
      await sendBookingStatusNotification({ booking_id: b.id, owner_email: user.email, owner_name: restaurant?.name ?? user.name, ref: restaurantBookingRef(b.id), itemTitle: b.item_title, status });
    }
    await refresh();
  };

  if (loading) return <div className="py-16 text-center text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;

  // No restaurant yet → create form.
  if (!restaurant) {
    return (
      <div>
        <div className="mb-4 rounded-xl border border-forest-200 bg-forest-50/60 px-4 py-3 text-sm text-forest-600">
          Add an in-house restaurant / dining for your {propertyType}. It appears in the customer Restaurants section and on your property page once an admin approves it.
        </div>
        <ProfileForm user={user} restaurant={null} propertyType={propertyType} propertyId={propertyId} propertyName={propertyName} onSaved={refresh} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="font-display text-xl font-bold text-forest">{restaurant.name}</h2>
        <StatusBadge status={restaurant.status} />
        {(restaurant as { pending_changes?: unknown }).pending_changes != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2.5 py-1 text-xs font-semibold text-gold-700">Edits pending admin review</span>
        )}
      </div>
      <div className="mb-5 flex gap-2">
        {([["menu", "Menu"], ["profile", "Profile"], ["bookings", "Bookings"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setView(id)} className={cn("rounded-full px-4 py-1.5 text-sm font-semibold transition-all", view === id ? "bg-gradient-forest text-white shadow-soft" : "border border-border bg-card text-forest hover:bg-muted")}>
            {label}
            {id === "bookings" && bookings.filter((b) => b.status === "pending").length > 0 && (<span className="ml-1 rounded-full bg-gold px-1.5 text-[10px] font-bold text-forest-900">{bookings.filter((b) => b.status === "pending").length}</span>)}
          </button>
        ))}
      </div>

      {view === "profile" && <ProfileForm user={user} restaurant={restaurant} propertyType={propertyType} propertyId={propertyId} propertyName={propertyName} onSaved={refresh} />}
      {view === "menu" && <MenuManager restaurant={restaurant} user={user} items={menu} onChange={refresh} />}
      {view === "bookings" && (
        <BookingsPanel bookings={bookings} unread={unread} onAct={act} onChat={(b) => { markSeen(b.id); setChatBooking(toRow(b)); }} />
      )}

      {chatBooking && (
        <ChatModal booking={chatBooking} currentEmail={user.email} currentName={user.name} currentAvatar={user.avatar} otherLabel={chatBooking.customer_name ?? chatBooking.customer_email} onSeen={() => markSeen(chatBooking.id)} onClose={() => setChatBooking(null)} />
      )}
    </div>
  );
}

/* ---------------- Profile form ---------------- */

function ProfileForm({ user, restaurant, propertyType, propertyId, propertyName, onSaved }: { user: User; restaurant: RestaurantRow | null; propertyType: "hotel" | "homestay" | "hostel"; propertyId: string | null; propertyName: string | null; onSaved: () => void }) {
  const editing = !!restaurant;
  const [f, setF] = React.useState({
    name: restaurant?.name ?? (propertyName ? `${propertyName} Restaurant` : ""),
    logo: restaurant?.logo ?? "",
    cover_image: restaurant?.cover_image ?? "",
    gallery: restaurant?.gallery ?? [],
    phone: restaurant?.phone ?? "",
    whatsapp: restaurant?.whatsapp ?? "",
    location: restaurant?.location ?? "",
    city: restaurant?.city ?? "",
    opening_hours: restaurant?.opening_hours ?? "",
    closing_hours: restaurant?.closing_hours ?? "",
    cuisine_types: restaurant?.cuisine_types ?? ([] as string[]),
    price_range: restaurant?.price_range ?? "Mid-range",
    description: restaurant?.description ?? "",
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saved, setSaved] = React.useState(false);
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  const toggleCuisine = (v: string) => setF((x) => ({ ...x, cuisine_types: x.cuisine_types.includes(v) ? x.cuisine_types.filter((c) => c !== v) : [...x.cuisine_types, v] }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!f.name.trim()) { setError("Please enter a restaurant name."); return; }
    setSaving(true);
    const payload = {
      property_type: propertyType,
      property_id: propertyId,
      property_name: propertyName,
      name: f.name.trim(),
      logo: f.logo.trim() || null,
      cover_image: f.cover_image.trim() || null,
      gallery: f.gallery,
      phone: f.phone.trim() || null,
      whatsapp: f.whatsapp.trim() || null,
      location: f.location.trim() || null,
      city: f.city.trim() || null,
      opening_hours: f.opening_hours.trim() || null,
      closing_hours: f.closing_hours.trim() || null,
      cuisine_types: f.cuisine_types,
      price_range: f.price_range,
      description: f.description.trim() || null,
      owner_email: user.email,
    };
    const { error: dbError } = editing ? await updateRestaurant(restaurant!.id, payload) : await createRestaurant(payload);
    setSaving(false);
    if (dbError) { setError(dbError.message); return; }
    setSaved(true);
    onSaved();
  };

  return (
    <form onSubmit={save} className="space-y-5 rounded-3xl border border-border/70 bg-card p-6 shadow-premium sm:p-8">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">{error}</div>}
      {saved && <div className="flex items-center gap-2 rounded-lg border border-forest-200 bg-forest-50 px-4 py-2.5 text-sm font-medium text-forest-600"><CheckCircle2 className="h-4 w-4" /> Saved</div>}
      <div className="flex items-center gap-4">
        <AvatarUpload value={f.logo} onChange={(url) => set({ logo: url })} />
        <div className="flex-1"><Field label="Restaurant name" required><input value={f.name} onChange={(e) => set({ name: e.target.value })} className="auth-input" /></Field></div>
      </div>
      <div><span className="mb-1.5 block text-sm font-semibold text-forest">Cover image</span><ImageUpload value={f.cover_image} onChange={(url) => set({ cover_image: url })} /></div>
      <div><span className="mb-1.5 block text-sm font-semibold text-forest">Gallery images</span><MultiImageUpload value={f.gallery} onChange={(urls) => set({ gallery: urls })} /></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Phone"><input value={f.phone} onChange={(e) => set({ phone: e.target.value })} className="auth-input" /></Field>
        <Field label="WhatsApp"><input value={f.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} className="auth-input" /></Field>
        <Field label="Price range"><select value={f.price_range} onChange={(e) => set({ price_range: e.target.value })} className="auth-input">{PRICE_RANGES.map((p) => <option key={p} value={p}>{p}</option>)}</select></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="City / district"><input value={f.city} onChange={(e) => set({ city: e.target.value })} className="auth-input" /></Field>
        <Field label="Location"><input value={f.location} onChange={(e) => set({ location: e.target.value })} className="auth-input" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Opening hours"><input value={f.opening_hours} onChange={(e) => set({ opening_hours: e.target.value })} className="auth-input" placeholder="7:00 AM" /></Field>
        <Field label="Closing hours"><input value={f.closing_hours} onChange={(e) => set({ closing_hours: e.target.value })} className="auth-input" placeholder="11:00 PM" /></Field>
      </div>
      <div>
        <span className="mb-1.5 block text-sm font-semibold text-forest">Cuisine type</span>
        <div className="flex flex-wrap gap-2">
          {CUISINE_TYPES.map((o) => (
            <button type="button" key={o} onClick={() => toggleCuisine(o)} className={cn("rounded-full px-3 py-1.5 text-xs font-semibold transition-colors", f.cuisine_types.includes(o) ? "bg-gradient-forest text-white shadow-soft" : "border border-border bg-card text-forest hover:bg-muted")}>{o}</button>
          ))}
        </div>
      </div>
      <Field label="Description"><textarea rows={3} value={f.description} onChange={(e) => set({ description: e.target.value })} className="auth-input resize-none" /></Field>
      <Button type="submit" variant="gold" size="lg" className="rounded-lg" disabled={saving}>
        {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : editing ? "Save changes" : "Create restaurant"}
      </Button>
    </form>
  );
}

/* ---------------- Menu manager ---------------- */

function MenuManager({ restaurant, user, items, onChange }: { restaurant: RestaurantRow; user: User; items: MenuItemRow[]; onChange: () => void }) {
  const [editing, setEditing] = React.useState<MenuItemRow | null>(null);
  const [adding, setAdding] = React.useState(false);
  if (adding || editing) return <MenuForm restaurant={restaurant} user={user} item={editing} onDone={() => { setAdding(false); setEditing(null); onChange(); }} onCancel={() => { setAdding(false); setEditing(null); }} />;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Add the dishes your {restaurant.property_type ?? "property"} serves.</p>
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
                  {m.discount_price != null ? (<><span className="font-display font-bold text-forest">{formatPrice(m.discount_price)}</span><span className="text-xs text-muted-foreground line-through">{formatPrice(m.price)}</span></>) : (<span className="font-display font-bold text-forest">{formatPrice(m.price)}</span>)}
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
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-forest">{editing ? "Edit menu item" : "Add menu item"}</h3>
        <button type="button" onClick={onCancel} className="text-sm font-medium text-forest-600 hover:text-gold">← Back</button>
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">{error}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Item name" required><input value={f.name} onChange={(e) => set({ name: e.target.value })} className="auth-input" /></Field>
        <Field label="Category"><select value={f.category} onChange={(e) => set({ category: e.target.value })} className="auth-input">{MENU_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
      </div>
      <div><span className="mb-1.5 block text-sm font-semibold text-forest">Item image</span><ImageUpload value={f.image} onChange={(url) => set({ image: url })} /></div>
      <Field label="Short description"><textarea rows={2} value={f.description} onChange={(e) => set({ description: e.target.value })} className="auth-input resize-none" /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Price (PKR)" required><input type="number" value={f.price} onChange={(e) => set({ price: e.target.value })} className="auth-input" /></Field>
        <Field label="Discount price"><input type="number" value={f.discount_price} onChange={(e) => set({ discount_price: e.target.value })} className="auth-input" /></Field>
        <Field label="Serving size"><input value={f.serving_size} onChange={(e) => set({ serving_size: e.target.value })} className="auth-input" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Availability"><select value={f.availability} onChange={(e) => set({ availability: e.target.value })} className="auth-input"><option value="available">Available</option><option value="unavailable">Unavailable</option></select></Field>
        <Field label="Spicy level"><select value={f.spicy_level} onChange={(e) => set({ spicy_level: e.target.value })} className="auth-input">{SPICY_LEVELS.map((s) => <option key={s} value={s}>{s}</option>)}</select></Field>
        <div className="flex items-end gap-4 pb-3">
          <label className="flex items-center gap-2 text-sm font-medium text-forest"><input type="checkbox" checked={f.featured} onChange={(e) => set({ featured: e.target.checked })} className="h-4 w-4 accent-forest-600" /> Featured</label>
          <label className="flex items-center gap-2 text-sm font-medium text-forest"><input type="checkbox" checked={f.vegetarian} onChange={(e) => set({ vegetarian: e.target.checked })} className="h-4 w-4 accent-forest-600" /> Veg</label>
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="gold" size="lg" className="rounded-lg" disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : editing ? "Save changes" : "Publish"}</Button>
        <Button type="button" variant="outline" size="lg" className="rounded-lg" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

/* ---------------- Bookings ---------------- */

function BookingsPanel({ bookings, unread, onAct, onChat }: { bookings: RestaurantBookingRow[]; unread: Set<string>; onAct: (id: string, s: "accepted" | "rejected") => void; onChat: (b: RestaurantBookingRow) => void }) {
  if (bookings.length === 0) {
    return <div className="rounded-3xl border border-dashed border-border bg-muted/40 py-14 text-center"><CalendarCheck className="mx-auto h-9 w-9 text-forest-600" /><p className="mt-2 text-sm text-muted-foreground">No table bookings or food inquiries yet.</p></div>;
  }
  return (
    <div className="space-y-3">
      {bookings.map((b) => (
        <div key={b.id} className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-xs font-bold tracking-wider text-forest-600">{restaurantBookingRef(b.id)} · {b.booking_type === "inquiry" ? "Food Inquiry" : "Table Booking"}</p>
              <p className="text-sm font-semibold text-forest">{b.customer_name ?? "—"} · {b.guests} guest{b.guests > 1 ? "s" : ""}</p>
              <p className="text-xs text-muted-foreground">{b.date ?? "—"} {b.time ?? ""}</p>
            </div>
            {b.status !== "pending" && <span className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase", b.status === "accepted" ? "bg-forest-50 text-forest-600" : "bg-red-50 text-red-600")}>{b.status}</span>}
          </div>
          {b.notes && <p className="mt-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-forest"><span className="font-semibold">Note:</span> {b.notes}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {b.status === "pending" && (<>
              <button onClick={() => onAct(b.id, "accepted")} className="flex items-center gap-1.5 rounded-xl bg-gradient-forest px-3.5 py-2 text-sm font-semibold text-white shadow-soft hover:-translate-y-0.5"><CheckCircle2 className="h-4 w-4" /> Accept</button>
              <button onClick={() => onAct(b.id, "rejected")} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"><XCircle className="h-4 w-4" /> Reject</button>
            </>)}
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

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (<label className="block"><span className="mb-1.5 block text-sm font-semibold text-forest">{label} {required && <span className="text-gold-600">*</span>}</span>{children}</label>);
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

export const RESTAURANT_TAB_ICON = UtensilsCrossed;
