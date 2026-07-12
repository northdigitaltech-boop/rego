"use client";

import * as React from "react";
import {
  PlusCircle,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  MessageSquare,
  CalendarCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ImageUpload, AvatarUpload } from "@/components/ui/image-upload";
import { ChatModal } from "@/components/chat/chat-modal";
import { useUnread } from "@/lib/use-unread";
import { type User } from "@/components/auth/auth-context";
import { type BookingRow } from "@/lib/bookings";
import { type TourCompanyRow } from "@/lib/tour-companies";
import {
  getMediaByCompany,
  createMediaProvider,
  updateMediaProvider,
  deleteMediaProvider,
  SERVICE_TYPES,
  type MediaProviderRow,
} from "@/lib/media";
import {
  getMediaBookingsByOwner,
  setMediaBookingStatus,
  mediaBookingRef,
  type MediaBookingRow,
} from "@/lib/media-bookings";
import { sendBookingStatusNotification } from "@/lib/messages";
import { cn, formatPrice } from "@/lib/utils";

const splitList = (s: string) =>
  s.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean);
const joinList = (a: string[] | null | undefined) => (a ?? []).join(", ");
const num = (v: string) => {
  const n = Number(v);
  return v.trim() && !Number.isNaN(n) ? n : null;
};

/**
 * Self-contained Media Team manager for the tour-company dashboard. Lets a
 * company add photographers / videographers (linked via company_id) and
 * manage their shoot bookings — without touching the existing tour booking flow.
 */
export function MediaTeamManager({
  company,
  user,
}: {
  company: TourCompanyRow;
  user: User;
}) {
  const [providers, setProviders] = React.useState<MediaProviderRow[]>([]);
  const [bookings, setBookings] = React.useState<MediaBookingRow[]>([]);
  const [editing, setEditing] = React.useState<MediaProviderRow | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [chatBooking, setChatBooking] = React.useState<BookingRow | null>(null);

  const refresh = React.useCallback(async () => {
    const [p, b] = await Promise.all([
      getMediaByCompany(company.id),
      getMediaBookingsByOwner(user.email),
    ]);
    setProviders(p);
    setBookings(b.filter((x) => x.company_id === company.id));
  }, [company.id, user.email]);

  React.useEffect(() => {
    refresh();
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
  const { unread, markSeen } = useUnread(
    bookings.map((b) => b.id),
    user.email,
    { sound: false }
  );
  const openChat = (b: MediaBookingRow) => {
    markSeen(b.id);
    setChatBooking(toRow(b));
  };

  const act = async (id: string, status: "accepted" | "rejected" | "completed") => {
    const b = bookings.find((x) => x.id === id);
    await setMediaBookingStatus(id, status);
    if (b) {
      await sendBookingStatusNotification({
        booking_id: b.id,
        owner_email: user.email,
        owner_name: company.name ?? user.name,
        ref: mediaBookingRef(b.id),
        itemTitle: b.item_title,
        status,
      });
    }
    await refresh();
  };

  if (adding || editing) {
    return (
      <ProviderForm
        company={company}
        user={user}
        provider={editing}
        onDone={() => { setAdding(false); setEditing(null); refresh(); }}
        onCancel={() => { setAdding(false); setEditing(null); }}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-forest">Media Team</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Add photographers &amp; videographers under your company. They appear
              on your company profile and the customer Photographers page once an
              admin approves them.
            </p>
          </div>
          <Button variant="gold" className="rounded-lg" onClick={() => setAdding(true)}>
            <PlusCircle className="h-4 w-4" /> Add media provider
          </Button>
        </div>
        <div className="mt-5 space-y-3">
          {providers.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-muted/40 py-14 text-center text-sm text-muted-foreground">
              No media providers yet.
            </div>
          ) : (
            providers.map((p) => (
              <div key={p.id} className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-card p-4 shadow-premium sm:flex-row sm:items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.logo ?? p.cover_image ?? ""} alt={p.name} className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-base font-semibold text-forest">{p.name}</h3>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{p.service_type} · {p.city ?? p.location ?? ""}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="font-display font-bold text-forest">{formatPrice(p.starting_price)} <span className="text-xs font-normal text-muted-foreground">starting</span></p>
                    <div className="flex gap-2">
                      <button onClick={() => setEditing(p)} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-forest hover:bg-muted"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                      <button onClick={async () => { await deleteMediaProvider(p.id); refresh(); }} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Media bookings for this company */}
      <div>
        <h3 className="font-display text-lg font-bold text-forest">Media bookings</h3>
        {bookings.length === 0 ? (
          <div className="mt-3 rounded-3xl border border-dashed border-border bg-muted/40 py-12 text-center text-sm text-muted-foreground">
            <CalendarCheck className="mx-auto h-8 w-8 text-forest-600" />
            <p className="mt-2">No media bookings yet.</p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {bookings.map((b) => (
              <div key={b.id} className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-xs font-bold tracking-wider text-forest-600">
                      {mediaBookingRef(b.id)}{b.service_title ? ` · ${b.service_title}` : ""}
                    </p>
                    <p className="font-display text-base font-semibold text-forest">{b.item_title}</p>
                    <p className="text-sm font-semibold text-forest">{formatPrice(b.total_price)} · {b.people} {b.people > 1 ? "people" : "person"}</p>
                  </div>
                  {b.status !== "pending" && <BookingStatusBadge status={b.status} />}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {b.status === "pending" && (
                    <>
                      <button onClick={() => act(b.id, "accepted")} className="flex items-center gap-1.5 rounded-xl bg-gradient-forest px-3.5 py-2 text-sm font-semibold text-white shadow-soft hover:-translate-y-0.5"><CheckCircle2 className="h-4 w-4" /> Accept</button>
                      <button onClick={() => act(b.id, "rejected")} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"><XCircle className="h-4 w-4" /> Reject</button>
                    </>
                  )}
                  {b.status === "accepted" && (
                    <button onClick={() => act(b.id, "completed")} className="flex items-center gap-1.5 rounded-xl bg-gold px-3.5 py-2 text-sm font-semibold text-forest-900 shadow-soft hover:-translate-y-0.5"><CheckCircle2 className="h-4 w-4" /> Mark completed</button>
                  )}
                  <button
                    onClick={() => openChat(b)}
                    className={cn("relative flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors", unread.has(b.id) ? "border-red-300 bg-red-50 text-red-600" : "border-border text-forest hover:bg-muted")}
                  >
                    <MessageSquare className="h-4 w-4" /> Message
                    {unread.has(b.id) && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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

function ProviderForm({
  company,
  user,
  provider,
  onDone,
  onCancel,
}: {
  company: TourCompanyRow;
  user: User;
  provider: MediaProviderRow | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const editing = !!provider;
  const [f, setF] = React.useState({
    name: provider?.name ?? "",
    service_type: provider?.service_type ?? "Photographer",
    logo: provider?.logo ?? "",
    cover_image: provider?.cover_image ?? "",
    phone: provider?.phone ?? "",
    whatsapp: provider?.whatsapp ?? "",
    city: provider?.city ?? "",
    location: provider?.location ?? company.location ?? "",
    areas: joinList(provider?.areas),
    experience_years: provider?.experience_years ? String(provider.experience_years) : "",
    starting_price: provider?.starting_price ? String(provider.starting_price) : "",
    bio: provider?.bio ?? "",
    drone_available: provider?.drone_available ?? false,
    editing_included: provider?.editing_included ?? true,
    delivery_time: provider?.delivery_time ?? "",
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!f.name.trim() || !Number(f.starting_price)) {
      setError("Please enter a name and a valid starting price.");
      return;
    }
    setSaving(true);
    const payload = {
      company_id: company.id,
      company_name: company.name,
      name: f.name.trim(),
      service_type: f.service_type,
      logo: f.logo.trim() || `https://i.pravatar.cc/300?u=${encodeURIComponent(f.name.trim())}`,
      cover_image: f.cover_image.trim() || null,
      phone: f.phone.trim() || null,
      whatsapp: f.whatsapp.trim() || null,
      city: f.city.trim() || null,
      location: f.location.trim() || company.location,
      areas: splitList(f.areas),
      experience_years: num(f.experience_years),
      starting_price: Number(f.starting_price),
      bio: f.bio.trim() || null,
      drone_available: f.drone_available,
      editing_included: f.editing_included,
      delivery_time: f.delivery_time.trim() || null,
      owner_email: user.email,
    };
    const { error: dbError } = editing
      ? await updateMediaProvider(provider!.id, payload)
      : await createMediaProvider(payload);
    setSaving(false);
    if (dbError) { setError(dbError.message); return; }
    onDone();
  };

  return (
    <form onSubmit={save} className="space-y-5 rounded-3xl border border-border/70 bg-card p-6 shadow-premium sm:p-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-forest">{editing ? "Edit media provider" : "Add media provider"}</h2>
        <button type="button" onClick={onCancel} className="text-sm font-medium text-forest-600 hover:text-gold">← Back</button>
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">{error}</div>}
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
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Phone"><input value={f.phone} onChange={(e) => set({ phone: e.target.value })} className="auth-input" /></Field>
        <Field label="WhatsApp"><input value={f.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} className="auth-input" /></Field>
        <Field label="Delivery time"><input value={f.delivery_time} onChange={(e) => set({ delivery_time: e.target.value })} className="auth-input" placeholder="7–10 days" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="City / district"><input value={f.city} onChange={(e) => set({ city: e.target.value })} className="auth-input" /></Field>
        <Field label="Areas covered (comma separated)"><input value={f.areas} onChange={(e) => set({ areas: e.target.value })} className="auth-input" /></Field>
        <div className="flex items-end gap-4 pb-3">
          <label className="flex items-center gap-2 text-sm font-medium text-forest"><input type="checkbox" checked={f.drone_available} onChange={(e) => set({ drone_available: e.target.checked })} className="h-4 w-4 accent-forest-600" /> Drone</label>
          <label className="flex items-center gap-2 text-sm font-medium text-forest"><input type="checkbox" checked={f.editing_included} onChange={(e) => set({ editing_included: e.target.checked })} className="h-4 w-4 accent-forest-600" /> Editing</label>
        </div>
      </div>
      <Field label="Bio / about"><textarea rows={3} value={f.bio} onChange={(e) => set({ bio: e.target.value })} className="auth-input resize-none" /></Field>
      <div className="flex gap-2">
        <Button type="submit" variant="gold" size="lg" className="rounded-lg" disabled={saving}>
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : editing ? "Save changes" : "Publish"}
        </Button>
        <Button type="button" variant="outline" size="lg" className="rounded-lg" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
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
    completed: { label: "Completed", cls: "bg-forest-600 text-white" },
    rejected: { label: "Rejected", cls: "bg-red-50 text-red-600" },
    pending: { label: "Pending", cls: "bg-gold/20 text-gold-700" },
  };
  const s = map[status] ?? map.pending;
  return <span className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase", s.cls)}>{s.label}</span>;
}
