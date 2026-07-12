"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, LifeBuoy, MapPin, Clock, Navigation } from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import {
  getRequestsByCustomer,
  serviceName,
  requestStatusLabel,
  type RoadsideRequestRow,
} from "@/lib/roadside";
import { RoadsideTrackModal } from "@/components/roadside/track-modal";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-gold/20 text-gold-700",
    accepted: "bg-forest-50 text-forest-600",
    on_the_way: "bg-blue-50 text-blue-600",
    completed: "bg-green-50 text-green-600",
    cancelled: "bg-red-50 text-red-600",
  };
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", map[status] ?? "bg-muted")}>
      {requestStatusLabel(status)}
    </span>
  );
}

export function RoadsideMyRequests() {
  const { user } = useAuth();
  const [rows, setRows] = React.useState<RoadsideRequestRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [tracking, setTracking] = React.useState<RoadsideRequestRow | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!user) return;
      const r = await getRequestsByCustomer(user.email);
      if (alive) {
        setRows(r);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  if (loading) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 py-16 text-center">
        <LifeBuoy className="mx-auto h-10 w-10 text-forest-600" />
        <p className="mt-2 font-display text-lg font-semibold text-forest">No roadside requests yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Need help on the road?{" "}
          <Link href="/roadside" className="font-semibold text-forest-600 underline">
            Find a provider
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-premium">
      <h2 className="font-display text-lg font-bold text-forest">My roadside requests</h2>
      <div className="mt-3 divide-y divide-border">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-forest">
                  {serviceName(r.service_type || "")}
                  {r.provider_name ? ` · ${r.provider_name}` : ""}
                </p>
                <StatusBadge status={r.status} />
              </div>
              <p className="font-display text-xs font-bold tracking-wider text-forest-600">
                {r.request_number}
              </p>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {r.location_address || "—"}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {new Date(r.created_at).toLocaleDateString()}
                </span>
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {["accepted", "on_the_way"].includes(r.status) && (
                <button
                  onClick={() => setTracking(r)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-forest px-3 py-1.5 text-xs font-semibold text-white shadow-soft hover:opacity-95"
                >
                  <Navigation className="h-3.5 w-3.5" /> Track live
                </button>
              )}
              {r.provider_id && (
                <Link
                  href={`/roadside/provider/${r.provider_id}`}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-forest hover:bg-muted"
                >
                  View provider
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {tracking && (
        <RoadsideTrackModal request={tracking} onClose={() => setTracking(null)} />
      )}
    </div>
  );
}
