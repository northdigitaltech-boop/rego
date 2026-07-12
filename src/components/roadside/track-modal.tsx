"use client";

import * as React from "react";
import { X, Navigation, Clock, Loader2 } from "lucide-react";

import {
  getRoadsideRequestById,
  requestStatusLabel,
  serviceName,
  type RoadsideRequestRow,
} from "@/lib/roadside";
import { subscribeToTracking } from "@/lib/realtime";
import { LiveMap, type LatLng, type EtaInfo } from "@/components/roadside/live-map";
import { cn } from "@/lib/utils";

export function RoadsideTrackModal({
  request,
  onClose,
}: {
  request: RoadsideRequestRow;
  onClose: () => void;
}) {
  const [req, setReq] = React.useState<RoadsideRequestRow>(request);
  const [providerPos, setProviderPos] = React.useState<LatLng | null>(
    request.provider_lat != null && request.provider_lng != null
      ? { lat: request.provider_lat, lng: request.provider_lng }
      : null
  );
  const [destPos, setDestPos] = React.useState<LatLng | null>(null);
  const [geoError, setGeoError] = React.useState(false);
  const [eta, setEta] = React.useState<EtaInfo | null>(null);
  const [lastPingAt, setLastPingAt] = React.useState<number | null>(
    request.provider_location_at ? new Date(request.provider_location_at).getTime() : null
  );

  // Customer's own location = the breakdown location (destination for the provider).
  React.useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGeoError(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setDestPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError(true),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Live provider position over the broadcast channel.
  React.useEffect(() => {
    const unsub = subscribeToTracking(request.id, (p) => {
      setProviderPos({ lat: p.lat, lng: p.lng });
      setLastPingAt(p.at);
    });
    return unsub;
  }, [request.id]);

  // Poll the request row for status changes + a fallback position every 15s.
  React.useEffect(() => {
    const id = setInterval(async () => {
      const fresh = await getRoadsideRequestById(request.id);
      if (fresh) {
        setReq(fresh);
        if (fresh.provider_lat != null && fresh.provider_lng != null && !providerPos) {
          setProviderPos({ lat: fresh.provider_lat, lng: fresh.provider_lng });
        }
      }
    }, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.id]);

  // A fresh position tick (within 60s) is authoritative — the provider is
  // actively sharing. Fall back to the persisted tracking_active flag otherwise.
  const stale = lastPingAt == null || Date.now() - lastPingAt > 60000;
  const sharing = !!providerPos && (!stale || req.tracking_active);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-card shadow-premium-lg sm:rounded-3xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="font-display text-base font-bold text-forest">Live tracking</p>
            <p className="text-xs text-muted-foreground">
              {serviceName(req.service_type || "")} · {req.request_number}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-forest">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Status + ETA banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <StatusDot status={req.status} />
              <span className="font-semibold text-forest">{requestStatusLabel(req.status)}</span>
            </div>
            {eta && sharing && (
              <span className="flex items-center gap-1.5 text-sm font-semibold text-forest">
                <Clock className="h-4 w-4 text-gold" /> ETA {eta.duration}
                <span className="font-normal text-muted-foreground">({eta.distance})</span>
              </span>
            )}
          </div>

          {/* Map */}
          <LiveMap provider={providerPos} destination={destPos} onEta={setEta} heightClass="h-80" />

          {/* Hints */}
          {req.status === "completed" || req.status === "cancelled" ? (
            <p className="rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
              This request is {requestStatusLabel(req.status).toLowerCase()}. Live tracking is off.
            </p>
          ) : !sharing ? (
            <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              <Loader2 className="h-4 w-4 animate-spin" />
              Waiting for {req.provider_name || "the provider"} to start sharing their live location…
            </p>
          ) : null}

          {geoError && (
            <p className="rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
              Enable location access to show your position and an accurate ETA.
            </p>
          )}

          {/* Contact provider */}
          <div className="grid grid-cols-2 gap-2">
            {req.customer_phone && req.provider_id && (
              <a
                href={`/roadside/provider/${req.provider_id}`}
                className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-sm font-semibold text-forest hover:bg-muted"
              >
                <Navigation className="h-4 w-4" /> View provider profile
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "on_the_way"
      ? "bg-blue-500"
      : status === "accepted"
        ? "bg-forest-500"
        : status === "completed"
          ? "bg-green-500"
          : status === "cancelled"
            ? "bg-red-500"
            : "bg-gold";
  return <span className={cn("h-2.5 w-2.5 rounded-full", color)} />;
}
