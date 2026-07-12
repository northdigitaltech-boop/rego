"use client";

import * as React from "react";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  X,
  CalendarCheck,
  Phone,
  MessageCircle,
  Mountain,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ImageUpload, MultiImageUpload } from "@/components/ui/image-upload";
import { type User } from "@/components/auth/auth-context";
import {
  getActivitiesByOwner,
  createActivity,
  updateActivity,
  deleteActivity,
  getActivityBookingsByOwner,
  setActivityBookingStatus,
  activityBookingRef,
  activityCategoryName,
  ACTIVITY_CATEGORIES,
  INDOOR_ACTIVITY_CATEGORIES,
  isIndoorActivity,
  DIFFICULTIES,
  PRICE_UNITS,
  type ActivityRow,
  type ActivityBookingRow,
} from "@/lib/activities";
import { sendEmail } from "@/lib/email";
import { cn, formatPrice } from "@/lib/utils";

const splitList = (s: string) => s.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean);
const joinList = (a: string[] | null | undefined) => (a ?? []).join(", ");
const numOrNull = (v: string) => (v.trim() && !Number.isNaN(Number(v)) ? Number(v) : null);

export function ActivitiesManager({
  user,
  ownerType,
  businessName,
}: {
  user: User;
  ownerType: "activity-provider" | "travel-company" | "guide";
  businessName?: string;
}) {
  const [view, setView] = React.useState<"list" | "requests">("list");
  const [activities, setActivities] = React.useState<ActivityRow[]>([]);
  const [bookings, setBookings] = React.useState<ActivityBookingRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState<ActivityRow | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const [a, b] = await Promise.all([
      getActivitiesByOwner(user.email),
      getActivityBookingsByOwner(user.email),
    ]);
    setActivities(a);
    setBookings(b);
    setLoading(false);
  }, [user.email]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const pending = bookings.filter((b) => b.status === "pending").length;

  const updateBooking = async (b: ActivityBookingRow, status: "accepted" | "rejected" | "completed") => {
    setBusyId(b.id);
    await setActivityBookingStatus(b.id, status);
    if (b.customer_email) {
      void sendEmail(
        b.customer_email,
        `Activity booking ${activityBookingRef(b.id)} — ${status}`,
        `<p>Your booking request <strong>${activityBookingRef(b.id)}</strong> for ${b.activity_title} is now <strong>${status}</strong>.</p>`
      ).catch(() => {});
    }
    await refresh();
    setBusyId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-border bg-card p-1">
          <button onClick={() => setView("list")} className={cn("rounded-lg px-4 py-1.5 text-sm font-semibold", view === "list" ? "bg-gradient-forest text-white" : "text-forest hover:bg-muted")}>My Activities</button>
          <button onClick={() => setView("requests")} className={cn("rounded-lg px-4 py-1.5 text-sm font-semibold", view === "requests" ? "bg-gradient-forest text-white" : "text-forest hover:bg-muted")}>
            Requests{pending > 0 && <span className="ml-1.5 text-xs opacity-80">({pending})</span>}
          </button>
        </div>
        {view === "list" && (
          <Button variant="gold" className="rounded-lg" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add Activity
          </Button>
        )}
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
      ) : view === "list" ? (
        activities.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 py-16 text-center">
            <Mountain className="mx-auto h-10 w-10 text-forest-600" />
            <p className="mt-2 font-display text-lg font-semibold text-forest">No activities yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Add your first adventure — it goes live once an admin approves it.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {activities.map((a) => (
              <div key={a.id} className="flex gap-3 rounded-2xl border border-border bg-card p-3 shadow-premium">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.image || "https://picsum.photos/seed/act/200/200"} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-forest">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{activityCategoryName(a.category)} · {a.price > 0 ? formatPrice(a.price) : "Enquire"}</p>
                  <StatusBadge status={a.status} />
                  <div className="mt-2 flex items-center gap-1">
                    <a href={`/activities/${a.id}`} target="_blank" rel="noopener noreferrer" className="rounded-md border border-border p-1.5 text-forest hover:bg-muted"><ExternalLink className="h-3.5 w-3.5" /></a>
                    <button onClick={() => setEditing(a)} className="rounded-md border border-border p-1.5 text-forest hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => { if (window.confirm(`Delete “${a.title}”?`)) deleteActivity(a.id).then(refresh); }} className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : bookings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 py-16 text-center">
          <CalendarCheck className="mx-auto h-10 w-10 text-forest-600" />
          <p className="mt-2 font-display text-lg font-semibold text-forest">No booking requests yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <div key={b.id} className="rounded-2xl border border-border bg-card p-4 shadow-premium">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-forest">{b.activity_title || "Activity"}</p>
                    <StatusBadge status={b.status} />
                  </div>
                  <p className="text-xs font-semibold tracking-wider text-forest-600">{activityBookingRef(b.id)}</p>
                </div>
                <p className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleString()}</p>
              </div>
              <div className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                <span>Customer: <b className="text-forest">{b.customer_name || "—"}</b></span>
                <span>Phone: {b.customer_phone || "—"}</span>
                <span>Date: {b.date || "—"}</span>
                <span>People: {b.people}</span>
              </div>
              {b.notes && <p className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{b.notes}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                {b.customer_phone && <a href={`tel:${b.customer_phone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-forest hover:bg-muted"><Phone className="h-4 w-4" /> Call</a>}
                {b.customer_phone && <a href={`https://wa.me/${b.customer_phone.replace(/[^\d]/g, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-semibold text-green-700"><MessageCircle className="h-4 w-4" /> WhatsApp</a>}
                {b.status === "pending" && (
                  <>
                    <button disabled={busyId === b.id} onClick={() => updateBooking(b, "accepted")} className="rounded-lg bg-forest-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-60">Accept</button>
                    <button disabled={busyId === b.id} onClick={() => updateBooking(b, "rejected")} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60">Reject</button>
                  </>
                )}
                {b.status === "accepted" && (
                  <button disabled={busyId === b.id} onClick={() => updateBooking(b, "completed")} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">Complete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(adding || editing) && (
        <ActivityForm
          user={user}
          ownerType={ownerType}
          businessName={businessName}
          activity={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { setAdding(false); setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}

function ActivityForm({
  user,
  ownerType,
  businessName,
  activity,
  onClose,
  onSaved,
}: {
  user: User;
  ownerType: string;
  businessName?: string;
  activity: ActivityRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initialKind: "outdoor" | "indoor" =
    activity && isIndoorActivity(activity.category) ? "indoor" : "outdoor";
  const [kind, setKind] = React.useState<"outdoor" | "indoor">(initialKind);

  const [f, setF] = React.useState({
    title: activity?.title ?? "",
    category:
      activity?.category ??
      (initialKind === "indoor" ? INDOOR_ACTIVITY_CATEGORIES[0].slug : ACTIVITY_CATEGORIES[0].slug),
    opening_hours: activity?.opening_hours ?? "",
    business_name: activity?.business_name ?? businessName ?? "",
    description: activity?.description ?? "",
    location: activity?.location ?? "",
    city: activity?.city ?? "",
    meeting_point: activity?.meeting_point ?? "",
    duration: activity?.duration ?? "",
    difficulty: activity?.difficulty ?? "moderate",
    group_size_min: activity?.group_size_min != null ? String(activity.group_size_min) : "",
    group_size_max: activity?.group_size_max != null ? String(activity.group_size_max) : "",
    price: activity?.price != null ? String(activity.price) : "",
    price_unit: activity?.price_unit ?? "person",
    age_limit: activity?.age_limit ?? "",
    season: activity?.season ?? "",
    includes: joinList(activity?.includes),
    excludes: joinList(activity?.excludes),
    languages: joinList(activity?.languages),
    highlights: joinList(activity?.highlights),
    phone: activity?.phone ?? "",
    whatsapp: activity?.whatsapp ?? "",
    email: activity?.email ?? user.email,
  });
  const [image, setImage] = React.useState(activity?.image ?? "");
  const [gallery, setGallery] = React.useState<string[]>(activity?.gallery ?? []);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const switchKind = (next: "outdoor" | "indoor") => {
    setKind(next);
    // Reset category to a valid one for the chosen kind.
    const list = next === "indoor" ? INDOOR_ACTIVITY_CATEGORIES : ACTIVITY_CATEGORIES;
    if (!list.some((c) => c.slug === f.category)) set("category", list[0].slug);
  };

  const save = async () => {
    setError("");
    if (!f.title.trim()) { setError("Activity title is required."); return; }
    setSaving(true);
    const payload = {
      owner_email: user.email,
      owner_type: ownerType,
      business_name: f.business_name.trim() || businessName || user.name,
      title: f.title.trim(),
      category: f.category,
      activity_kind: kind,
      opening_hours: kind === "indoor" ? f.opening_hours.trim() || null : null,
      description: f.description.trim() || null,
      location: f.location.trim() || null,
      city: f.city.trim() || null,
      meeting_point: f.meeting_point.trim() || null,
      duration: f.duration.trim() || null,
      difficulty: f.difficulty,
      group_size_min: numOrNull(f.group_size_min),
      group_size_max: numOrNull(f.group_size_max),
      price: Number(f.price) || 0,
      price_unit: f.price_unit,
      age_limit: f.age_limit.trim() || null,
      season: f.season.trim() || null,
      includes: splitList(f.includes),
      excludes: splitList(f.excludes),
      languages: splitList(f.languages),
      highlights: splitList(f.highlights),
      phone: f.phone.trim() || null,
      whatsapp: f.whatsapp.trim() || null,
      email: f.email.trim() || null,
      image: image || null,
      gallery,
    };
    const { error: err } = activity ? await updateActivity(activity.id, payload) : await createActivity({ ...payload, status: "pending" });
    setSaving(false);
    if (err) { setError("Could not save. Please try again."); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-6 w-full max-w-2xl rounded-3xl bg-card p-6 shadow-premium-lg">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-forest"><Mountain className="h-5 w-5 text-gold" /> {activity ? "Edit activity" : "Add activity"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-forest"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <span className="mb-1.5 block text-sm font-semibold text-forest">Cover image</span>
            <ImageUpload value={image} onChange={setImage} />
          </div>
          {/* Outdoor vs Indoor */}
          <div>
            <span className="mb-1.5 block text-sm font-semibold text-forest">Activity category</span>
            <div className="inline-flex rounded-xl border border-border bg-card p-1">
              {(["outdoor", "indoor"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => switchKind(k)}
                  className={
                    "rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition-colors " +
                    (kind === k ? "bg-gradient-forest text-white" : "text-forest hover:bg-muted")
                  }
                >
                  {k === "indoor" ? "Indoor Activity" : "Outdoor Activity"}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <L label="Title" required><input className="auth-input" value={f.title} onChange={(e) => set("title", e.target.value)} /></L>
            <L label={kind === "indoor" ? "Indoor activity type" : "Activity type"}>
              <select className="auth-input" value={f.category} onChange={(e) => set("category", e.target.value)}>
                {(kind === "indoor" ? INDOOR_ACTIVITY_CATEGORIES : ACTIVITY_CATEGORIES).map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name}</option>
                ))}
              </select>
            </L>
            {kind === "indoor" && (
              <L label="Opening hours"><input className="auth-input" value={f.opening_hours} onChange={(e) => set("opening_hours", e.target.value)} placeholder="e.g. 10:00 AM – 10:00 PM" /></L>
            )}
            <L label="Business / operator name"><input className="auth-input" value={f.business_name} onChange={(e) => set("business_name", e.target.value)} /></L>
            <L label="Location"><input className="auth-input" value={f.location} onChange={(e) => set("location", e.target.value)} placeholder="Skardu, Hunza…" /></L>
            <L label="City"><input className="auth-input" value={f.city} onChange={(e) => set("city", e.target.value)} /></L>
            <L label="Meeting point"><input className="auth-input" value={f.meeting_point} onChange={(e) => set("meeting_point", e.target.value)} /></L>
            <L label="Duration"><input className="auth-input" value={f.duration} onChange={(e) => set("duration", e.target.value)} placeholder="Full day, 3 days…" /></L>
            <L label="Difficulty"><select className="auth-input capitalize" value={f.difficulty} onChange={(e) => set("difficulty", e.target.value)}>{DIFFICULTIES.map((d) => <option key={d} value={d} className="capitalize">{d}</option>)}</select></L>
            <L label="Price (PKR)"><input type="number" min={0} className="auth-input" value={f.price} onChange={(e) => set("price", e.target.value)} /></L>
            <L label="Price unit"><select className="auth-input capitalize" value={f.price_unit} onChange={(e) => set("price_unit", e.target.value)}>{PRICE_UNITS.map((u) => <option key={u} value={u} className="capitalize">{u}</option>)}</select></L>
            <L label="Group size min"><input type="number" min={0} className="auth-input" value={f.group_size_min} onChange={(e) => set("group_size_min", e.target.value)} /></L>
            <L label="Group size max"><input type="number" min={0} className="auth-input" value={f.group_size_max} onChange={(e) => set("group_size_max", e.target.value)} /></L>
            <L label="Age limit"><input className="auth-input" value={f.age_limit} onChange={(e) => set("age_limit", e.target.value)} placeholder="e.g. 12+" /></L>
            <L label="Best season"><input className="auth-input" value={f.season} onChange={(e) => set("season", e.target.value)} placeholder="May–Oct" /></L>
            <L label="Phone"><input className="auth-input" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></L>
            <L label="WhatsApp"><input className="auth-input" value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></L>
          </div>
          <L label="Description"><textarea rows={3} className="auth-input resize-none" value={f.description} onChange={(e) => set("description", e.target.value)} /></L>
          <div className="grid gap-3 sm:grid-cols-2">
            <L label="Includes (comma separated)"><textarea rows={2} className="auth-input resize-none" value={f.includes} onChange={(e) => set("includes", e.target.value)} placeholder="Guide, Meals, Equipment" /></L>
            <L label="Excludes (comma separated)"><textarea rows={2} className="auth-input resize-none" value={f.excludes} onChange={(e) => set("excludes", e.target.value)} placeholder="Transport, Insurance" /></L>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <L label="Highlights (comma separated)"><input className="auth-input" value={f.highlights} onChange={(e) => set("highlights", e.target.value)} /></L>
            <L label="Languages (comma separated)"><input className="auth-input" value={f.languages} onChange={(e) => set("languages", e.target.value)} placeholder="English, Urdu" /></L>
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-semibold text-forest">Gallery images</span>
            <MultiImageUpload value={gallery} onChange={setGallery} />
          </div>
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" className="rounded-lg" onClick={onClose}>Cancel</Button>
            <Button variant="gold" className="rounded-lg" onClick={save} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : activity ? "Save changes" : "Create activity"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function L({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label} {required && <span className="text-gold-600">*</span>}</span>
      {children}
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "bg-forest-50 text-forest-600",
    pending: "bg-gold/20 text-gold-700",
    rejected: "bg-red-50 text-red-600",
    suspended: "bg-gray-100 text-gray-600",
    accepted: "bg-forest-50 text-forest-600",
    completed: "bg-green-50 text-green-600",
  };
  return <span className={cn("mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", map[status] ?? "bg-muted")}>{status}</span>;
}
