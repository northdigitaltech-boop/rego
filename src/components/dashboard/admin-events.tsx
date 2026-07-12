"use client";

import * as React from "react";
import {
  Loader2,
  Search,
  PlusCircle,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Star,
  ExternalLink,
  X,
  CalendarDays,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ImageUpload, MultiImageUpload } from "@/components/ui/image-upload";
import {
  getAllEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  setEventStatus,
  setEventFeatured,
  eventCategoryName,
  EVENT_CATEGORIES,
  type EventRow,
} from "@/lib/events";
import { cn, formatPrice } from "@/lib/utils";

const splitList = (s: string) =>
  s.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean);
const joinList = (a: string[] | null | undefined) => (a ?? []).join(", ");

export function AdminEvents() {
  const [rows, setRows] = React.useState<EventRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState("");
  const [editing, setEditing] = React.useState<EventRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setRows(await getAllEvents());
    setLoading(false);
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    await fn();
    await refresh();
    setBusyId(null);
  };

  const filtered = rows.filter((e) => {
    if (!q.trim()) return true;
    const hay = `${e.title} ${eventCategoryName(e.category)} ${e.city ?? ""} ${e.status}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-forest">Events &amp; Expo</h2>
        <Button variant="gold" className="rounded-lg" onClick={() => setCreating(true)}>
          <PlusCircle className="h-4 w-4" /> Add event
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-premium">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search events by title, category, city, status…"
            className="w-full bg-transparent text-sm focus:outline-none"
          />
          <span className="shrink-0 text-xs text-muted-foreground">{filtered.length} events</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="p-3">Event</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">City</th>
                  <th className="p-3">Entry</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No events yet. Click “Add event” to create one.
                    </td>
                  </tr>
                ) : (
                  filtered.map((e) => {
                    const busy = busyId === e.id;
                    return (
                      <tr key={e.id} className="border-b border-border/60">
                        <td className="p-3">
                          <div className="flex items-center gap-1.5 font-semibold text-forest">
                            {e.title}
                            {e.featured && <Star className="h-3.5 w-3.5 fill-gold text-gold" />}
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground">{eventCategoryName(e.category)}</td>
                        <td className="p-3 text-muted-foreground">{e.start_date || "—"}</td>
                        <td className="p-3 text-muted-foreground">{e.city || "—"}</td>
                        <td className="p-3 text-muted-foreground">
                          {e.ticket_price > 0 ? formatPrice(e.ticket_price) : "Free"}
                        </td>
                        <td className="p-3">
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
                              e.status === "published"
                                ? "bg-forest-50 text-forest-600"
                                : "bg-gold/20 text-gold-700"
                            )}
                          >
                            {e.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <a
                              href={`/events/${e.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View"
                              className="rounded-md border border-border p-1.5 text-forest hover:bg-muted"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            <button
                              title="Edit"
                              onClick={() => setEditing(e)}
                              className="rounded-md border border-border p-1.5 text-forest hover:bg-muted"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              title={e.status === "published" ? "Unpublish" : "Publish"}
                              disabled={busy}
                              onClick={() =>
                                act(e.id, () =>
                                  setEventStatus(e.id, e.status === "published" ? "draft" : "published")
                                )
                              }
                              className="rounded-md border border-border p-1.5 text-forest hover:bg-muted"
                            >
                              {e.status === "published" ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <button
                              title={e.featured ? "Unfeature" : "Feature"}
                              disabled={busy}
                              onClick={() => act(e.id, () => setEventFeatured(e.id, !e.featured))}
                              className={cn(
                                "rounded-md border p-1.5",
                                e.featured
                                  ? "border-gold/40 bg-gold/15 text-gold-700"
                                  : "border-border text-forest hover:bg-muted"
                              )}
                            >
                              <Star className="h-3.5 w-3.5" />
                            </button>
                            <button
                              title="Delete"
                              disabled={busy}
                              onClick={() => {
                                if (window.confirm(`Delete “${e.title}”? This cannot be undone.`)) {
                                  act(e.id, () => deleteEvent(e.id));
                                }
                              }}
                              className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(creating || editing) && (
        <EventFormModal
          event={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function EventFormModal({
  event,
  onClose,
  onSaved,
}: {
  event: EventRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = React.useState({
    title: event?.title ?? "",
    category: event?.category ?? EVENT_CATEGORIES[0].slug,
    description: event?.description ?? "",
    city: event?.city ?? "",
    venue: event?.venue ?? "",
    address: event?.address ?? "",
    start_date: event?.start_date ?? "",
    end_date: event?.end_date ?? "",
    time: event?.time ?? "",
    organizer: event?.organizer ?? "",
    ticket_price: event?.ticket_price != null ? String(event.ticket_price) : "",
    ticket_info: event?.ticket_info ?? "",
    registration_url: event?.registration_url ?? "",
    highlights: joinList(event?.highlights),
    status: event?.status ?? "published",
  });
  const [image, setImage] = React.useState(event?.image ?? "");
  const [gallery, setGallery] = React.useState<string[]>(event?.gallery ?? []);
  const [featured, setFeatured] = React.useState(event?.featured ?? false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setError("");
    if (!f.title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    const payload = {
      title: f.title.trim(),
      category: f.category,
      description: f.description.trim() || null,
      city: f.city.trim() || null,
      venue: f.venue.trim() || null,
      address: f.address.trim() || null,
      start_date: f.start_date || null,
      end_date: f.end_date || null,
      time: f.time.trim() || null,
      organizer: f.organizer.trim() || null,
      ticket_price: Number(f.ticket_price) || 0,
      ticket_info: f.ticket_info.trim() || null,
      registration_url: f.registration_url.trim() || null,
      highlights: splitList(f.highlights),
      image: image || null,
      gallery,
      featured,
      status: f.status,
    };
    const { error: err } = event
      ? await updateEvent(event.id, payload)
      : await createEvent(payload);
    setSaving(false);
    if (err) {
      setError("Could not save the event. Please try again.");
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-6 w-full max-w-2xl rounded-3xl bg-card p-6 shadow-premium-lg">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-forest">
            <CalendarDays className="h-5 w-5 text-gold" />
            {event ? "Edit event" : "Add event"}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-forest">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-start gap-6">
            <div>
              <span className="mb-1.5 block text-sm font-semibold text-forest">Cover image</span>
              <ImageUpload value={image} onChange={setImage} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <L label="Title" required>
              <input className="auth-input" value={f.title} onChange={(e) => set("title", e.target.value)} />
            </L>
            <L label="Category">
              <select className="auth-input" value={f.category} onChange={(e) => set("category", e.target.value)}>
                {EVENT_CATEGORIES.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name}</option>
                ))}
              </select>
            </L>
            <L label="Start date">
              <input type="date" className="auth-input" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} />
            </L>
            <L label="End date">
              <input type="date" className="auth-input" value={f.end_date} onChange={(e) => set("end_date", e.target.value)} />
            </L>
            <L label="Time">
              <input className="auth-input" value={f.time} onChange={(e) => set("time", e.target.value)} placeholder="e.g. 10:00 AM – 6:00 PM" />
            </L>
            <L label="City">
              <input className="auth-input" value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Gilgit, Skardu…" />
            </L>
            <L label="Venue">
              <input className="auth-input" value={f.venue} onChange={(e) => set("venue", e.target.value)} />
            </L>
            <L label="Address">
              <input className="auth-input" value={f.address} onChange={(e) => set("address", e.target.value)} />
            </L>
            <L label="Organizer">
              <input className="auth-input" value={f.organizer} onChange={(e) => set("organizer", e.target.value)} />
            </L>
            <L label="Entry price (PKR, 0 = free)">
              <input type="number" min={0} className="auth-input" value={f.ticket_price} onChange={(e) => set("ticket_price", e.target.value)} />
            </L>
            <L label="Ticket info">
              <input className="auth-input" value={f.ticket_info} onChange={(e) => set("ticket_info", e.target.value)} placeholder="Where / how to get tickets" />
            </L>
            <L label="Registration / website URL">
              <input className="auth-input" value={f.registration_url} onChange={(e) => set("registration_url", e.target.value)} placeholder="https://…" />
            </L>
          </div>

          <L label="Description">
            <textarea rows={4} className="auth-input resize-none" value={f.description} onChange={(e) => set("description", e.target.value)} />
          </L>
          <L label="Highlights (comma or new-line separated)">
            <textarea rows={2} className="auth-input resize-none" value={f.highlights} onChange={(e) => set("highlights", e.target.value)} placeholder="Live music, Food stalls, Fireworks…" />
          </L>

          <div>
            <span className="mb-1.5 block text-sm font-semibold text-forest">Gallery images</span>
            <MultiImageUpload value={gallery} onChange={setGallery} />
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <L label="Status">
              <select className="auth-input" value={f.status} onChange={(e) => set("status", e.target.value)}>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </L>
            <label className="flex items-center gap-2 pt-6 text-sm font-semibold text-forest">
              <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="h-4 w-4" />
              Featured
            </label>
          </div>

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" className="rounded-lg" onClick={onClose}>Cancel</Button>
            <Button variant="gold" className="rounded-lg" onClick={save} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : event ? "Save changes" : "Create event"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function L({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">
        {label} {required && <span className="text-gold-600">*</span>}
      </span>
      {children}
    </label>
  );
}
