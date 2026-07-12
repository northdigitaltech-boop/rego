"use client";

import * as React from "react";
import { X, Search, Loader2, CalendarRange } from "lucide-react";

import { Button } from "@/components/ui/button";
import { lookupBooking, type BookingLookupResult } from "@/lib/booking-lookup";
import { cn, formatPrice } from "@/lib/utils";

export function BookingStatusModal({ onClose }: { onClose: () => void }) {
  const [ref, setRef] = React.useState("");
  const [result, setResult] = React.useState<BookingLookupResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ref.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    const r = await lookupBooking(ref);
    setLoading(false);
    if (!r) {
      setError(
        "No booking found with that reference. Please check it and try again."
      );
      return;
    }
    setResult(r);
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center p-4">
      <div className="absolute inset-0 bg-forest-900/50" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-premium-lg">
        <div className="flex items-center justify-between bg-gradient-forest px-5 py-4 text-white">
          <p className="flex items-center gap-2 font-display text-base font-bold">
            <CalendarRange className="h-5 w-5" /> Check booking status
          </p>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-white/90 hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          <form onSubmit={search} className="flex gap-2">
            <input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="e.g. SGB-2D7F95E9"
              className="auth-input flex-1 uppercase"
            />
            <Button
              type="submit"
              variant="gold"
              className="rounded-lg px-4"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            Enter the booking reference from your confirmation.
          </p>

          {error && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          {result && (
            <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-premium">
              <div className="flex items-center justify-between">
                <p className="font-display text-xs font-bold tracking-wider text-forest-600">
                  {result.ref}
                </p>
                <StatusBadge status={result.status} />
              </div>
              <h3 className="mt-1 font-display text-lg font-bold text-forest">
                {result.title}
              </h3>
              {result.room_name && (
                <p className="text-sm text-muted-foreground">
                  {result.room_name}
                </p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <KV k="Check-in" v={result.check_in ?? "—"} />
                <KV k="Check-out" v={result.check_out ?? "—"} />
                <KV k="Guests" v={String(result.guests)} />
                <KV
                  k="Rooms"
                  v={String(result.rooms)}
                />
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-display text-lg font-bold text-forest">
                  {formatPrice(result.total_price)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {k}
      </p>
      <p className="font-medium text-forest">{v}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    accepted: { label: "Confirmed", cls: "bg-forest-50 text-forest-600" },
    rejected: { label: "Declined", cls: "bg-red-50 text-red-600" },
    pending: { label: "Pending", cls: "bg-gold/20 text-gold-700" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase",
        s.cls
      )}
    >
      {s.label}
    </span>
  );
}
