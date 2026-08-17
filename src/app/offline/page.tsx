import type { Metadata } from "next";

import { OfflineRetry } from "@/components/pwa/offline-retry";

/* ============================================================
 * Offline fallback.
 *
 * A static page, so the service worker can precache it and it
 * never depends on the network to render.
 *
 * It deliberately does NOT claim that anything works offline.
 * Bookings, search, the AI assistant, maps and road updates all
 * need a connection — telling someone otherwise on the one screen
 * that appears when they have no signal would be a strange time
 * to start being optimistic.
 * ============================================================ */

export const metadata: Metadata = {
  title: "You're offline — Rego",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="container-px flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-forest-50">
        {/* Inline SVG so the icon needs no network request. */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          className="h-8 w-8 text-forest-600"
          aria-hidden="true"
        >
          <path d="M2 2l20 20" />
          <path d="M8.5 16.5a5 5 0 0 1 7 0" />
          <path d="M2 8.82a15 15 0 0 1 4.17-2.65" />
          <path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76" />
          <path d="M16.85 11.25a10 10 0 0 1 2.22 1.68" />
          <path d="M5 12.86a10 10 0 0 1 5.17-2.69" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      </span>

      <h1 className="mt-6 font-display text-2xl font-bold text-forest sm:text-3xl">
        You&apos;re offline
      </h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        Please check your internet connection and try again.
      </p>

      <OfflineRetry />

      <p className="mt-8 max-w-sm text-xs leading-relaxed text-muted-foreground">
        Bookings, search, road updates and Rego AI all need a connection, so
        they will not work until you are back online.
      </p>
    </div>
  );
}
