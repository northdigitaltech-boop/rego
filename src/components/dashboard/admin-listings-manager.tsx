"use client";

import * as React from "react";
import { Loader2, Trash2, EyeOff, Eye, Search, RefreshCw, UserX, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getAllManagedListings,
  adminHideListing,
  adminUnhideListing,
  adminDeleteListing,
  adminDeleteOwnerListings,
  type ManagedListing,
} from "@/lib/admin-actions";

function statusStyle(status: string) {
  if (status === "approved") return "bg-emerald-100 text-emerald-700";
  if (status === "rejected") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}
function statusLabel(status: string) {
  if (status === "approved") return "Live";
  if (status === "rejected") return "Hidden";
  return "Pending";
}

export function AdminListingsManager() {
  const [listings, setListings] = React.useState<ManagedListing[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");

  const load = React.useCallback(() => {
    getAllManagedListings().then(setListings);
  }, []);
  React.useEffect(() => {
    load();
  }, [load]);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      load();
    } finally {
      setBusy(null);
    }
  };

  if (!listings) {
    return (
      <div className="grid h-40 place-items-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const types = Array.from(new Set(listings.map((l) => l.type))).sort();
  const owners = Array.from(new Set(listings.map((l) => l.ownerEmail).filter(Boolean))).sort();

  const q = search.trim().toLowerCase();
  const filtered = listings.filter((l) => {
    if (typeFilter !== "all" && l.type !== typeFilter) return false;
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (q && !`${l.title} ${l.ownerEmail} ${l.type}`.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-forest">Manage &amp; Delete Listings</h2>
          <p className="text-sm text-muted-foreground">
            Hide, restore or permanently remove any listing from the site. {listings.length} total.
          </p>
        </div>
        <Button variant="outline" onClick={load}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <strong>Hide</strong> takes a listing off the public site but keeps it (reversible).{" "}
          <strong>Delete permanently</strong> removes it from the database for good and cannot be undone.
        </span>
      </p>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or owner…"
            className="w-56 bg-transparent py-2 text-sm focus:outline-none"
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
          <option value="all">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
          <option value="all">All statuses</option>
          <option value="approved">Live</option>
          <option value="pending">Pending</option>
          <option value="rejected">Hidden</option>
        </select>
      </div>

      {/* Listings */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            No listings match your filters.
          </p>
        )}
        {filtered.map((l) => {
          const key = `${l.table}:${l.id}`;
          const isBusy = busy === key;
          return (
            <div key={key} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-forest">{l.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {l.type}
                  {l.ownerEmail ? ` · ${l.ownerEmail}` : ""}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusStyle(l.status)}`}>
                {statusLabel(l.status)}
              </span>
              {l.status === "rejected" ? (
                <button
                  disabled={isBusy}
                  onClick={() => act(key, () => adminUnhideListing(l.table, l.id))}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-forest hover:bg-muted disabled:opacity-50"
                >
                  {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />} Unhide
                </button>
              ) : (
                <button
                  disabled={isBusy}
                  onClick={() => act(key, () => adminHideListing(l.table, l.id))}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-forest hover:bg-muted disabled:opacity-50"
                >
                  {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />} Hide
                </button>
              )}
              <button
                disabled={isBusy}
                onClick={() => {
                  if (window.confirm(`Permanently delete "${l.title}"? This cannot be undone.`)) {
                    act(key, () => adminDeleteListing(l.table, l.id));
                  }
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          );
        })}
      </div>

      {/* Owner removal */}
      <section className="rounded-2xl border border-red-200 bg-red-50/50 p-5">
        <h3 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-red-700">
          <UserX className="h-4 w-4" /> Remove an owner from the site
        </h3>
        <p className="mt-1 text-xs text-red-700/80">
          Permanently deletes every listing belonging to an owner across all categories. Their login account
          is not removed here — delete that from Supabase → Authentication → Users if needed.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {owners.length === 0 && <span className="text-xs text-muted-foreground">No owners found.</span>}
          {owners.map((email) => {
            const count = listings.filter((l) => l.ownerEmail === email).length;
            const key = `owner:${email}`;
            const isBusy = busy === key;
            return (
              <button
                key={email}
                disabled={isBusy}
                onClick={() => {
                  if (window.confirm(`Delete ALL ${count} listing(s) owned by ${email}? This cannot be undone.`)) {
                    act(key, () => adminDeleteOwnerListings(email));
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                title={`${count} listing(s)`}
              >
                {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {email} ({count})
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
