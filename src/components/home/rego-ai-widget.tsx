"use client";

import * as React from "react";
import { Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";

import { RegoAiChat } from "@/components/home/rego-ai-chat";

/** Floating "Ask Rego AI" button — sits above the Help Line button and opens a
 *  popup where travellers ask questions and get grounded recommendations. */
export function RegoAiWidget() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Floating button — stacked above the red help-line button */}
      <div className="fixed bottom-24 right-5 z-[90]">
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
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full bg-gold/40"
              animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.5, ease: "easeOut" }}
            />
            <Sparkles className="relative h-6 w-6 sm:h-7 sm:w-7" />
          </span>
        </button>
      </div>

      {/* Popup */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[120] flex items-stretch justify-center bg-forest-900/60 backdrop-blur-sm sm:items-center sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rego-ai-title"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 30, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.98 }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              className="flex h-full w-full flex-col overflow-hidden bg-card shadow-premium-lg sm:h-auto sm:max-h-[85vh] sm:max-w-lg sm:rounded-3xl"
            >
              {/* header */}
              <div className="flex items-center justify-between gap-3 bg-gradient-forest px-5 py-4 text-white">
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
              <div className="flex-1 overflow-y-auto p-4">
                <Suspense fallback={<div className="py-16 text-center text-muted-foreground">Loading…</div>}>
                  <RegoAiChat />
                </Suspense>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
