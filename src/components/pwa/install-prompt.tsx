"use client";

import * as React from "react";
import { Download, X, Share, Plus } from "lucide-react";

/* ============================================================
 * Install prompt.
 *
 * RULES THIS FOLLOWS, because install nags are the most disliked
 * thing on mobile web:
 *
 *   • Never shown if the app is already installed.
 *   • Never shown on Android unless the browser has actually fired
 *     beforeinstallprompt — no button that does nothing.
 *   • Dismissal is remembered for 30 days; installing hides it for
 *     good.
 *   • Not shown on the first pageview. Someone who has seen one
 *     page has no reason to want an icon on their home screen yet.
 *   • Never on auth pages or the private consoles.
 *
 * iOS has no programmatic install API, so Safari gets instructions
 * instead of a button that cannot work.
 * ============================================================ */

const DISMISS_KEY = "rego-install-dismissed";
const VIEWS_KEY = "rego-pageviews";
const DISMISS_DAYS = 30;
const MIN_VIEWS = 3;

const HIDE_ON = ["/signin", "/signup", "/reset-password", "/verify", "/auth", "/admin", "/cyber", "/offline"];

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari exposes this instead of display-mode.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !/crios|fxios/i.test(navigator.userAgent) // only Safari can add to home screen
  );
}

function recentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    if (raw === "installed") return true;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false; // private mode — just don't remember
  }
}

export function InstallPrompt() {
  const [deferred, setDeferred] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = React.useState(false);
  const [gone, setGone] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return; // already installed — nothing to offer
    if (recentlyDismissed()) return;
    if (HIDE_ON.some((p) => window.location.pathname.startsWith(p))) return;

    // Count pageviews so we don't ask a first-time visitor.
    let views = 0;
    try {
      views = Number(sessionStorage.getItem(VIEWS_KEY) ?? "0") + 1;
      sessionStorage.setItem(VIEWS_KEY, String(views));
    } catch {
      views = MIN_VIEWS; // storage blocked — don't let it block the feature
    }
    if (views < MIN_VIEWS) return;

    // Android / desktop Chrome: only show when the browser says it can.
    const onPrompt = (e: Event) => {
      e.preventDefault(); // stop the browser's own mini-infobar
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const onInstalled = () => {
      try { localStorage.setItem(DISMISS_KEY, "installed"); } catch { /* ignore */ }
      setDeferred(null);
      setGone(true);
    };
    window.addEventListener("appinstalled", onInstalled);

    // iOS: no API, so offer instructions instead.
    if (isIos()) setShowIos(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setGone(true);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "dismissed") dismiss();
    setDeferred(null);
  };

  if (gone) return null;
  if (!deferred && !showIos) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Rego"
      className="fixed inset-x-3 bottom-3 z-[55] mx-auto max-w-sm rounded-2xl border border-border bg-card p-4 shadow-premium sm:left-auto sm:right-4 sm:mx-0"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Not now"
        className="absolute right-3 top-3 text-muted-foreground hover:text-forest"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-forest-50 text-forest-600">
          <Download className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-sm font-bold text-forest">Install Rego</p>

          {deferred ? (
            <>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Add Rego to your home screen for faster access.
              </p>
              <button
                type="button"
                onClick={install}
                className="mt-3 w-full rounded-lg bg-gradient-forest px-3 py-2 text-xs font-bold text-white"
              >
                Install
              </button>
            </>
          ) : (
            /* iOS instructions — Safari gives no programmatic path. */
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Tap{" "}
              <Share className="inline h-3.5 w-3.5 -translate-y-px text-forest-600" />{" "}
              <span className="font-semibold text-forest">Share</span>, then{" "}
              <Plus className="inline h-3.5 w-3.5 -translate-y-px text-forest-600" />{" "}
              <span className="font-semibold text-forest">Add to Home Screen</span>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
