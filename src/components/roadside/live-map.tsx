"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as React from "react";
import { MapPin } from "lucide-react";

import { loadGoogleMaps, googleMapsConfigured } from "@/lib/google-maps";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface EtaInfo {
  duration: string;
  distance: string;
}

/**
 * Live map that shows the provider's moving position and the destination
 * (the customer's location), with a driving route + ETA via the Directions
 * service. Falls back gracefully when the Maps key is missing.
 */
export function LiveMap({
  provider,
  destination,
  onEta,
  heightClass = "h-72",
}: {
  provider: LatLng | null;
  destination: LatLng | null;
  onEta?: (eta: EtaInfo | null) => void;
  heightClass?: string;
}) {
  const divRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<any>(null);
  const provMarker = React.useRef<any>(null);
  const destMarker = React.useRef<any>(null);
  const dirService = React.useRef<any>(null);
  const dirRenderer = React.useRef<any>(null);
  const lastDirAt = React.useRef<number>(0);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");

  // Init map once.
  React.useEffect(() => {
    let alive = true;
    if (!googleMapsConfigured()) {
      setStatus("error");
      return;
    }
    loadGoogleMaps()
      .then((google: any) => {
        if (!alive || !divRef.current) return;
        const center = provider || destination || { lat: 35.9208, lng: 74.3081 }; // Gilgit
        mapRef.current = new google.maps.Map(divRef.current, {
          center,
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
        });
        dirService.current = new google.maps.DirectionsService();
        dirRenderer.current = new google.maps.DirectionsRenderer({
          map: mapRef.current,
          suppressMarkers: true,
          polylineOptions: { strokeColor: "#0d7a5f", strokeWeight: 5, strokeOpacity: 0.85 },
        });
        setStatus("ready");
      })
      .catch(() => {
        if (alive) setStatus("error");
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers + route when positions change.
  React.useEffect(() => {
    if (status !== "ready" || !mapRef.current) return;
    const w = window as any;
    const google = w.google;
    if (!google?.maps) return;

    // Provider (moving) marker.
    if (provider) {
      if (!provMarker.current) {
        provMarker.current = new google.maps.Marker({
          map: mapRef.current,
          title: "Provider",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: "#0d7a5f",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
        });
      }
      provMarker.current.setPosition(provider);
    }

    // Destination (customer) marker.
    if (destination) {
      if (!destMarker.current) {
        destMarker.current = new google.maps.Marker({
          map: mapRef.current,
          title: "You",
          icon: {
            path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            scale: 6,
            fillColor: "#d4a017",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });
      }
      destMarker.current.setPosition(destination);
    }

    // Fit bounds to whatever we have.
    if (provider && destination) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(provider);
      bounds.extend(destination);
      mapRef.current.fitBounds(bounds, 60);
    } else if (provider) {
      mapRef.current.panTo(provider);
    } else if (destination) {
      mapRef.current.panTo(destination);
    }

    // Directions + ETA (throttled to ~1 call / 12s to conserve quota).
    if (provider && destination && dirService.current && dirRenderer.current) {
      const now = Date.now();
      if (now - lastDirAt.current > 12000) {
        lastDirAt.current = now;
        dirService.current.route(
          {
            origin: provider,
            destination,
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result: any, dirStatus: string) => {
            if (dirStatus === "OK" && result) {
              dirRenderer.current.setDirections(result);
              const leg = result.routes?.[0]?.legs?.[0];
              if (leg && onEta) {
                onEta({
                  duration: leg.duration?.text ?? "",
                  distance: leg.distance?.text ?? "",
                });
              }
            }
          }
        );
      }
    }
  }, [provider, destination, status, onEta]);

  if (status === "error") {
    return (
      <div
        className={`grid ${heightClass} w-full place-items-center rounded-2xl border border-border bg-muted/40 text-center`}
      >
        <div className="px-6">
          <MapPin className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium text-forest">Live map unavailable</p>
          <p className="text-xs text-muted-foreground">
            The map needs a Google Maps API key to be configured.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${heightClass} w-full overflow-hidden rounded-2xl border border-border`}>
      <div ref={divRef} className="h-full w-full" />
      {status === "loading" && (
        <div className="absolute inset-0 grid place-items-center bg-muted/40 text-sm text-muted-foreground">
          Loading map…
        </div>
      )}
    </div>
  );
}
