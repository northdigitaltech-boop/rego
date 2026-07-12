"use client";

import * as React from "react";
import {
  Loader2,
  Search,
  CheckCircle2,
  XCircle,
  BadgeCheck,
  Ban,
  Trash2,
  ExternalLink,
} from "lucide-react";

import {
  getAllActivities,
  getAllActivityBookings,
  setActivityStatus,
  setActivityVerified,
  deleteActivity,
  activityCategoryName,
  type ActivityRow,
  type ActivityBookingRow,
} from "@/lib/activities";
import { cn, formatPrice } from "@/lib/utils";

type View = "activities" | "bookings";

export function AdminActivities() {
  const [view, setView] = React.useState<View>("activities");
  const [activities, setActivities] = React.useState<ActivityRow[]>([]);
  const [bookings, setBookings] = React.useState<ActivityBookingRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const [a, b] = await Promise.all([getAllActivities(), getAllActivityBookings()]);
    setActivities(a);
    setBookings(b);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-forest">Activities &amp; Adventures</h2>
        <div className="inline-flex rounded-xl border border-border bg-card p-1">
          {(["activities", "bookings"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn("rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition-colors", view === v ? "bg-gradient-forest text-white" : "text-forest hover:bg-muted")}
            >
              {v}
              {v === "bookings" && bookings.length > 0 && <span className="ml-1.5 text-xs opacity-80">({bookings.length})</span>}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
      ) : view === "activities" ? (
        <ActivitiesTable activities={activities} onChange={refresh} />
      ) : (
        <BookingsTable bookings={bookings} />
      )}
    </div>
  );
}

function ActivitiesTable({ activities, onChange }: { activities: ActivityRow[]; onChange: () => void }) {
  const [q, setQ] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    await fn();
    await onChange();
    setBusyId(null);
  };
  const rows = activities.filter((a) => !q.trim() || `${a.title} ${a.business_name ?? ""} ${activityCategoryName(a.category)} ${a.city ?? ""} ${a.status} ${a.owner_type}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="rounded-2xl border border-border bg-card shadow-premium">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search activities…" className="w-full bg-transparent text-sm focus:outline-none" />
        <span className="shrink-0 text-xs text-muted-foreground">{rows.length} activities</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="p-3">Activity</th>
              <th className="p-3">Category</th>
              <th className="p-3">Listed by</th>
              <th className="p-3">City</th>
              <th className="p-3">Price</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No activities match.</td></tr>
            ) : (
              rows.map((a) => {
                const busy = busyId === a.id;
                return (
                  <tr key={a.id} className="border-b border-border/60">
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 font-semibold text-forest">{a.title}{a.verified && <BadgeCheck className="h-3.5 w-3.5 text-gold" />}</div>
                      <p className="text-xs text-muted-foreground">{a.business_name || "—"}</p>
                    </td>
                    <td className="p-3 text-muted-foreground">{activityCategoryName(a.category)}</td>
                    <td className="p-3 capitalize text-muted-foreground">{a.owner_type.replace("-", " ")}</td>
                    <td className="p-3 text-muted-foreground">{a.city || "—"}</td>
                    <td className="p-3 text-muted-foreground">{a.price > 0 ? formatPrice(a.price) : "Enquire"}</td>
                    <td className="p-3">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
                        a.status === "approved" ? "bg-forest-50 text-forest-600" :
                        a.status === "pending" ? "bg-gold/20 text-gold-700" :
                        a.status === "rejected" ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-600")}>{a.status}</span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <a href={`/activities/${a.id}`} target="_blank" rel="noopener noreferrer" title="View" className="rounded-md border border-border p-1.5 text-forest hover:bg-muted"><ExternalLink className="h-3.5 w-3.5" /></a>
                        {a.status !== "approved" && <button title="Approve" disabled={busy} onClick={() => act(a.id, () => setActivityStatus(a.id, "approved"))} className="rounded-md border border-forest-200 bg-forest-50 p-1.5 text-forest-600 hover:bg-forest-100"><CheckCircle2 className="h-3.5 w-3.5" /></button>}
                        {a.status !== "rejected" && <button title="Reject" disabled={busy} onClick={() => act(a.id, () => setActivityStatus(a.id, "rejected"))} className="rounded-md border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100"><XCircle className="h-3.5 w-3.5" /></button>}
                        <button title={a.verified ? "Unverify" : "Verify"} disabled={busy} onClick={() => act(a.id, () => setActivityVerified(a.id, !a.verified))} className={cn("rounded-md border p-1.5", a.verified ? "border-gold/40 bg-gold/15 text-gold-700" : "border-border text-forest hover:bg-muted")}><BadgeCheck className="h-3.5 w-3.5" /></button>
                        {a.status !== "suspended" && <button title="Suspend" disabled={busy} onClick={() => act(a.id, () => setActivityStatus(a.id, "suspended"))} className="rounded-md border border-border p-1.5 text-forest hover:bg-muted"><Ban className="h-3.5 w-3.5" /></button>}
                        <button title="Delete" disabled={busy} onClick={() => { if (window.confirm(`Delete “${a.title}”?`)) act(a.id, () => deleteActivity(a.id)); }} className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BookingsTable({ bookings }: { bookings: ActivityBookingRow[] }) {
  const [q, setQ] = React.useState("");
  const rows = bookings.filter((b) => !q.trim() || `${b.activity_title ?? ""} ${b.customer_name ?? ""} ${b.customer_phone ?? ""} ${b.status}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="rounded-2xl border border-border bg-card shadow-premium">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search bookings…" className="w-full bg-transparent text-sm focus:outline-none" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="p-3">Activity</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Date</th>
              <th className="p-3">People</th>
              <th className="p-3">Status</th>
              <th className="p-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No bookings match.</td></tr>
            ) : (
              rows.map((b) => (
                <tr key={b.id} className="border-b border-border/60">
                  <td className="p-3 font-semibold text-forest">{b.activity_title || "—"}</td>
                  <td className="p-3 text-muted-foreground">{b.customer_name || "—"}</td>
                  <td className="p-3 text-muted-foreground">{b.customer_phone || "—"}</td>
                  <td className="p-3 text-muted-foreground">{b.date || "—"}</td>
                  <td className="p-3 text-muted-foreground">{b.people}</td>
                  <td className="p-3 capitalize text-muted-foreground">{b.status}</td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(b.created_at).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
