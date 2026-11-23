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
 * Opened ONLY on request (footer "Install App" button), never by itself.
 * Platform-specific path:
 *
 *   Android / Chrome / Edge  → real one-tap Install button
 *   iPhone & iPad (Safari)   → Share → Add to Home Screen steps
 *   Everything else          → open on a phone browser instead
 *
 * Rendered through a portal so no transformed ancestor can clip it.
 * ============================================================ */

/** Anything on the page can open the card by dispatching this. */
export const OPEN_INSTALL_EVENT = "rego-open-install";

const DISMISS_KEY = "rego-install-dismissed";
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

export function InstallPrompt() {
  const [open, setOpen] = React.useState(false);
  const [platform, setPlatform] = React.useState<Platform>("other");
  const [deferred, setDeferred] =
    React.useState<BeforeInstallPromptEvent | null>(null);
  const [mounted, setMounted] = React.useState(false);
  /* iOS and a Chrome that never offered a prompt cannot be installed from
     JavaScript at all. The card still leads with a download button — pressing
     it opens the steps, which is the only real install path there is. */
  const [showSteps, setShowSteps] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    /* Already running as an installed app — there is nothing to offer. */
    if (isStandalone()) return;

    const plat = detectPlatform();
    setPlatform(plat);

    /* The event is captured before hydration by InstallCapture, because
       Chrome usually fires it before React mounts. Read whatever was
       stashed, THEN keep listening in case it fires later. */
    const stashed = (window as unknown as {
      __regoInstallEvent?: BeforeInstallPromptEvent | null;
    }).__regoInstallEvent;
    if (stashed) setDeferred(stashed);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onCaptured = () => {
      const ev = (window as unknown as {
        __regoInstallEvent?: BeforeInstallPromptEvent | null;
      }).__regoInstallEvent;
      if (ev) setDeferred(ev);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("rego-installable", onCaptured);

    const onInstalled = () => {
      try { localStorage.setItem(DISMISS_KEY, "installed"); } catch { /* ignore */ }
      setOpen(false);
    };
    window.addEventListener("appinstalled", onInstalled);

    /* Asked for by hand — from the footer, or anywhere else that wants to
       offer it. This ignores every suppression rule on purpose: someone who
       goes looking for the install button has clearly not installed it, and
       being told "you already saw this card" would be useless. */
    const onAsk = () => {
      setShowSteps(false);
      setOpen(true);
    };
    window.addEventListener(OPEN_INSTALL_EVENT, onAsk);

    /* NO AUTOMATIC APPEARANCE.
       The card used to open by itself after the first scroll or tap, on
       every visit until the app was installed. A launch review found it
       covering search and "Book now" on first load — the one moment a
       visitor is deciding whether to stay. It now opens only when someone
       asks for it (the "Install App" button in the footer or the header
       menu), so it can never sit on top of the page's primary actions. */
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("rego-installable", onCaptured);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener(OPEN_INSTALL_EVENT, onAsk);
    };
  }, []);

  const close = React.useCallback(() => setOpen(false), []);

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
    /* Waited on so the card does not close underneath the browser's own
       dialog. The outcome itself is not needed: "appinstalled" is what records
       an install permanently, and declining just closes ours for this visit. */
    await deferred.userChoice;
    setDeferred(null);
    setOpen(false);
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
                {!showSteps && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowSteps(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-forest px-4 py-3 text-sm font-bold text-white shadow-soft transition-transform hover:-translate-y-0.5"
                    >
                      <Download className="h-4 w-4" /> Add Rego to Home Screen
                    </button>
                    <p className="mt-2 text-center text-[11px] text-muted-foreground">
                      Free · about 1 MB · no app store needed
                    </p>
                  </>
                )}
                {showSteps && (
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
              </>
            )}

            {mode === "other" && (
              <>
                {platform === "android" && !showSteps && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowSteps(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-forest px-4 py-3 text-sm font-bold text-white shadow-soft transition-transform hover:-translate-y-0.5"
                    >
                      <Download className="h-4 w-4" /> Add Rego to your phone
                    </button>
                    <p className="mt-2 text-center text-[11px] text-muted-foreground">
                      Free · about 1 MB · no app store needed
                    </p>
                  </>
                )}
                {(platform !== "android" || showSteps) && (
                  <>
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-forest">
                  {platform === "android" ? "Add to your phone" : "Install on your phone"}
                </p>
                {platform === "android" ? (
                  /* Chrome did not offer a programmatic prompt — usually
                     because the page is not yet on HTTPS, or the app is
                     already installed. Manual steps still work. */
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
                  /* Desktop. Chrome and Edge CAN install a web app — if we
                     are here, the browser simply has not offered the prompt
                     yet, so point at the control it puts in the address bar
                     rather than sending someone to a phone they may not have
                     to hand. Safari and Firefox genuinely cannot, hence the
                     second line. */
                  <>
                    <ol className="space-y-2.5">
                      <Step n={1} icon={<Download className="h-4 w-4" />}>
                        In <strong>Chrome</strong> or <strong>Edge</strong>, click the
                        install icon at the right of the address bar
                      </Step>
                      <Step n={2} icon={<MoreVertical className="h-4 w-4" />}>
                        Or open the browser <strong>menu</strong> and choose{" "}
                        <strong>Install Rego</strong>
                      </Step>
                    </ol>
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                      On Safari or Firefox, open{" "}
                      <strong className="text-forest">rego.services</strong> on your
                      phone instead — those browsers cannot install a web app.
                    </p>
                  </>
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
              </>
            )}
          </div>

          <button
            type="button"
            onClick={close}
            className="mt-3 w-full text-center text-xs font-semibold text-muted-foreground hover:text-forest"
          >
            Not now
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
      {/* Plain inline text, not a flex row: as flex items, the words and the
          <strong> pieces were laid out as separate boxes, which swallowed the
          spaces between them ("Tap theShare button"). */}
      <span className="pt-0.5 text-sm leading-relaxed text-foreground">
        <span className="mr-1.5 inline-block align-[-3px] text-forest-600">{icon}</span>
        {children}
      </span>
    </li>
  );
}
