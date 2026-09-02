"use client";

import * as React from "react";
import { Suspense } from "react";
import { Sparkles, X } from "lucide-react";

import { RegoAiChat } from "@/components/home/rego-ai-chat";
import { useScrollLock } from "@/lib/use-scroll-lock";
import { useViewportMetrics } from "@/lib/use-viewport-height";
import { useHideOnScrollDown } from "@/lib/use-hide-on-scroll";
import { cn } from "@/lib/utils";

/** Floating "Ask Rego AI" button — sits above the Help Line button and opens a
 *  popup where travellers ask questions and get grounded recommendations. */
export function RegoAiWidget() {
  const [open, setOpen] = React.useState(false);

  // Pins the page (iOS included) and restores the exact scroll position after.
  useScrollLock(open);
  // Visible area (shrinks AND shifts when the mobile keyboard opens).
  const vp = useViewportMetrics(open);
  // Get out of the way while the page scrolls down.
  const hidden = useHideOnScrollDown(open);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Floating button — stacked above the red help-line button. Tucks away
          while scrolling down so it never covers a card's own actions. */}
      <div
        className={cn(
          "rego-float-ai fixed bottom-24 right-5 z-[90] transition-all duration-300 ease-out",
          hidden && !open
            ? "pointer-events-none translate-y-24 opacity-0"
            : "translate-y-0 opacity-100"
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask Rego AI"
          className="group flex items-center"
        >
          <span className="mr-2 hidden max-w-0 overflow-hidden whitespace-nowrap rounded-full bg-card/90 py-2 text-sm font-semibold text-forest shadow-premium backdrop-blur-md transition-all duration-300 group-hover:max-w-[160px] group-hover:px-4 lg:inline-block">
            Ask Rego AI
          </span>
          <span className="relative grid h-12 w-12 place-items-center rounded-full bg-gradient-forest text-gold shadow-lg ring-2 ring-white/40 sm:h-14 sm:w-14">
            {/* animate-ping: same pulse, no library. */}
            <span aria-hidden className="absolute inset-0 rounded-full bg-gold/40 motion-safe:animate-ping" />
            <Sparkles className="relative h-6 w-6 sm:h-7 sm:w-7" />
          </span>
        </button>
      </div>

      {/* Popup */}
      {/* Was AnimatePresence — now a CSS fade, for the same reason as the
          help line: one exit animation is not worth 111 KB on every page. */}
      {open && (
          <div
            /* Anchored to the VISIBLE viewport, so the keyboard can't scroll
               the dialog out of view on iOS. */
            style={
              vp
                ? { top: vp.offsetTop, height: vp.height, bottom: "auto" }
                : undefined
            }
            className="fixed inset-x-0 top-0 z-[120] h-[100dvh] flex items-stretch justify-center overflow-hidden bg-forest-900/60 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 sm:items-center sm:p-4"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rego-ai-title"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="motion-safe:animate-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-200 flex h-full w-full max-w-full flex-col overflow-hidden bg-card shadow-premium-lg sm:h-auto sm:max-h-[85vh] sm:max-w-lg sm:rounded-3xl"
            >
              {/* header */}
              <div className="flex shrink-0 items-center justify-between gap-3 bg-gradient-forest px-5 py-4 text-white">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 text-gold">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 id="rego-ai-title" className="font-display text-base font-bold">Rego AI</h2>
                    <p className="text-xs text-white/80">Your Gilgit-Baltistan trip assistant</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close Rego AI"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* chat */}
              <div className="flex min-h-0 flex-1 flex-col">
                <Suspense fallback={<div className="py-16 text-center text-muted-foreground">Loading…</div>}>
                  <RegoAiChat onNavigate={() => setOpen(false)} />
                </Suspense>
              </div>
            </div>
          </div>
      )}
    </>
  );
}
