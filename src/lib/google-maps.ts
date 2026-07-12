"use client";

/**
 * Lightweight Google Maps JS API loader — injects the script once and resolves
 * with the global `google` object. Avoids adding an npm dependency.
 *
 * Requires env: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (a browser key restricted to
 * your domains in the Google Cloud console; Maps JavaScript API + Directions
 * API enabled).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

let loaderPromise: Promise<any> | null = null;

export function googleMapsConfigured(): boolean {
  return !!GOOGLE_MAPS_KEY;
}

export function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  const w = window as any;
  if (w.google?.maps) return Promise.resolve(w.google);
  if (!GOOGLE_MAPS_KEY) return Promise.reject(new Error("missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"));
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const cbName = "__sgbGmapsInit";
    w[cbName] = () => resolve(w.google);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      GOOGLE_MAPS_KEY
    )}&libraries=geometry&callback=${cbName}&loading=async`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
  return loaderPromise;
}
