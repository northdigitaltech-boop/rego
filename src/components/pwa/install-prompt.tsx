"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  X, Download, Share, PlusSquare, Zap, Bell, MoreVertical, Smartphone,
} from "lucide-react";


/* ============================================================
 * Install Rego — premium popup card.
 *
 * Shown once shortly after the first visit, on mobile and desktop,
 * with a platform-specific path:
 *
 *   Android / Chrome / Edge  → real one-tap Install button
 *   iPhone & iPad (Safari)   → Share → Add to Home Screen steps
 *   Everything else          → open on a phone browser instead
 *
 * RESTRAINT RULES — an install popup that reappears is the fastest
 * way to make people bounce, so:
 *   • never when already installed
 *   • dismissal remembered for 30 days, install remembered forever
 *   • one appearance per session, never twice
 *   • never on auth pages or the private consoles
 *   • Escape and backdrop both close it
 *
 * Rendered through a portal so no transformed ancestor can clip it.
 * ============================================================ */

const DISMISS_KEY = "rego-install-dismissed";
const SEEN_KEY = "rego-install-seen";
const DISMISS_DAYS = 30;
/** Let the page paint and settle before interrupting. */
const SHOW_AFTER_MS = 2500;

const HIDE_ON = [
  "/signin", "/signup", "/reset-password", "/verify", "/auth",
  "/admin", "/cyber", "/offline",
];

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "android" | "ios" | "other";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

/** iOS can only install from Safari — Chrome/Firefox on iOS cannot. */
function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  const iOS =
    /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS 13+ reports as a Mac; the touch points give it away.
    (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  if (iOS) return /crios|fxios|edgios/i.test(ua) ? "other" : "ios";
  if (/android/i.test(ua)) return "android";
  return "other";
}

function suppressed(): boolean {
  try {
    if (sessionStorage.getItem(SEEN_KEY)) return true; // once per session
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    if (raw === "installed") return true;
    const at = Number(raw);
    return Number.isFinite(at) && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false; // private mode — just don't remember
  }
}

export function InstallPrompt() {
  const [open, setOpen] = React.useState(false);
  const [platform, setPlatform] = React.useState<Platform>("other");
  const [deferred, setDeferred] =
    React.useState<BeforeInstallPromptEvent | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    if (HIDE_ON.some((p) => window.location.pathname.startsWith(p))) return;
    if (suppressed()) return;

    const plat = detectPlatform();
    setPlatform(plat);

    /* Chrome fires this when the app genuinely qualifies for install.
       Capturing it lets us offer a real button instead of instructions. */
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const onInstalled = () => {
      try { localStorage.setItem(DISMISS_KEY, "installed"); } catch { /* ignore */ }
      setOpen(false);
    };
    window.addEventListener("appinstalled", onInstalled);

    const timer = window.setTimeout(() => {
      setOpen(true);
      try { sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
    }, SHOW_AFTER_MS);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const close = React.useCallback(() => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setOpen(false);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    // Stop the page scrolling behind the card.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "accepted") setOpen(false);
    else close();
  };

  if (!mounted || !open) return null;

  /* Which of the three paths applies. A captured prompt always wins —
     if the browser can install directly, never show instructions. */
  const mode: "button" | "ios" | "other" = deferred
    ? "button"
    : platform === "ios"
    ? "ios"
    : "other";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-forest-900/50 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-rego-title"
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-card shadow-premium"
      >
        {/* Brand header */}
        <div className="relative bg-gradient-forest px-6 pb-6 pt-7 text-center">
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/15 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>

          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/95 shadow-soft">
            {/* The same file the manifest uses, so the popup previews the
                exact icon that lands on the home screen. */}
            <Image
              src="/icons/icon-192.png"
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 object-contain"
              unoptimized
            />
          </span>

          <h2
            id="install-rego-title"
            className="mt-3 font-display text-xl font-bold text-white"
          >
            Install Rego
          </h2>
          <p className="mt-1 text-sm text-white/80">
            Your whole Gilgit-Baltistan trip, one tap away.
          </p>
        </div>

        <div className="px-6 py-5">
          {/* Benefits — real ones only. No "works offline" claim, because
              bookings, search and the AI all need a connection. */}
          <ul className="space-y-2.5">
            <Benefit icon={<Zap className="h-4 w-4" />}>
              Opens instantly from your home screen
            </Benefit>
            <Benefit icon={<Smartphone className="h-4 w-4" />}>
              Full-screen, no browser bars
            </Benefit>
            <Benefit icon={<Bell className="h-4 w-4" />}>
              Faster access to bookings and road updates
            </Benefit>
          </ul>

          <div className="mt-5">
            {mode === "button" && (
              <>
                <button
                  type="button"
                  onClick={install}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-forest px-4 py-3 text-sm font-bold text-white shadow-soft transition-transform hover:-translate-y-0.5"
                >
                  <Download className="h-4 w-4" /> Install Rego
                </button>
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  Free · about 1 MB · no app store needed
                </p>
              </>
            )}

            {mode === "ios" && (
              <>
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-forest">
                  Add to your iPhone
                </p>
                <ol className="space-y-2.5">
                  <Step n={1} icon={<Share className="h-4 w-4" />}>
                    Tap the <strong>Share</strong> button in Safari&apos;s toolbar
                  </Step>
                  <Step n={2} icon={<PlusSquare className="h-4 w-4" />}>
                    Scroll down and choose <strong>Add to Home Screen</strong>
                  </Step>
                  <Step n={3} icon={<Download className="h-4 w-4" />}>
                    Tap <strong>Add</strong> — Rego appears on your home screen
                  </Step>
                </ol>
                <button
                  type="button"
                  onClick={close}
                  className="mt-4 w-full rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-muted"
                >
                  Got it
                </button>
              </>
            )}

            {mode === "other" && (
              <>
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-forest">
                  {platform === "android" ? "Add to your phone" : "Install on your phone"}
                </p>
                {platform === "android" ? (
                  <ol className="space-y-2.5">
                    <Step n={1} icon={<MoreVertical className="h-4 w-4" />}>
                      Open the browser <strong>menu</strong> (three dots)
                    </Step>
                    <Step n={2} icon={<Download className="h-4 w-4" />}>
                      Choose <strong>Install app</strong> or{" "}
                      <strong>Add to Home screen</strong>
                    </Step>
                  </ol>
                ) : (
                  /* Desktop Safari/Firefox can't install. Rather than a dead
                     button, point them somewhere it actually works. */
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Open <strong className="text-forest">rego.services</strong> on
                    your phone in <strong className="text-forest">Chrome</strong>{" "}
                    (Android) or <strong className="text-forest">Safari</strong>{" "}
                    (iPhone) to add Rego to your home screen.
                  </p>
                )}
                <button
                  type="button"
                  onClick={close}
                  className="mt-4 w-full rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-muted"
                >
                  Got it
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={close}
            className="mt-3 w-full text-center text-xs font-semibold text-muted-foreground hover:text-forest"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Benefit({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 text-sm text-foreground">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-forest-50 text-forest-600">
        {icon}
      </span>
      {children}
    </li>
  );
}

function Step({
  n,
  icon,
  children,
}: {
  n: number;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-forest-600 text-xs font-bold text-white">
        {n}
      </span>
      <span className="flex items-center gap-1.5 pt-0.5 text-sm leading-relaxed text-foreground">
        <span className="text-forest-600">{icon}</span>
        {children}
      </span>
    </li>
  );
}
