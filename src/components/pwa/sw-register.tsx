"use client";

import * as React from "react";
import { ArrowUpCircle, X } from "lucide-react";

/* ============================================================
 * Service worker registration + update handling.
 *
 * Registration is deferred until after load so it never competes
 * with the first paint.
 *
 * THE UPDATE PROMPT IS OPT-IN, NEVER AUTOMATIC. A worker that
 * calls skipWaiting() on its own can swap the app shell out from
 * under someone halfway through a booking form. So a new build
 * waits, we show a small bar, and the user picks the moment.
 * ============================================================ */

export function ServiceWorkerRegister() {
  const [waiting, setWaiting] = React.useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Registration requires a secure context; localhost counts.
    if (!window.isSecureContext) return;

    let reg: ServiceWorkerRegistration | undefined;

    const register = async () => {
      try {
        reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

        // A build that is installed but waiting to take over.
        if (reg.waiting) setWaiting(reg.waiting);

        reg.addEventListener("updatefound", () => {
          const next = reg?.installing;
          if (!next) return;
          next.addEventListener("statechange", () => {
            /* "installed" with an existing controller means this is an
               UPDATE, not a first install. Only then is there anything
               worth telling the user about. */
            if (next.state === "installed" && navigator.serviceWorker.controller) {
              setWaiting(next);
            }
          });
        });

        /* Check for a new build when the tab regains focus. Cheap, and
           it means a user who leaves the app open for days still gets
           offered the update. */
        const onFocus = () => void reg?.update().catch(() => {});
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
      } catch {
        /* A failed registration must never surface to the user — the
           site works perfectly well without a service worker. */
      }
    };

    if (document.readyState === "complete") void register();
    else window.addEventListener("load", () => void register(), { once: true });
  }, []);

  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let reloading = false;
    const onChange = () => {
      // Reload once, only after the user has asked for the update.
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    return () =>
      navigator.serviceWorker.removeEventListener("controllerchange", onChange);
  }, []);

  const applyUpdate = () => {
    waiting?.postMessage("SKIP_WAITING");
    setWaiting(null);
  };

  if (!waiting || dismissed) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-premium sm:left-auto sm:right-4 sm:mx-0"
    >
      <ArrowUpCircle className="h-5 w-5 shrink-0 text-forest-600" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-forest">New version available</p>
        <p className="text-xs text-muted-foreground">
          Reload when you&apos;re ready — nothing in progress will be lost.
        </p>
      </div>
      <button
        type="button"
        onClick={applyUpdate}
        className="shrink-0 rounded-lg bg-gradient-forest px-3 py-1.5 text-xs font-bold text-white"
      >
        Update
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 text-muted-foreground hover:text-forest"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
