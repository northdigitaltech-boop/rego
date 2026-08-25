"use client";

import * as React from "react";
import { Download } from "lucide-react";

import { OPEN_INSTALL_EVENT } from "@/components/pwa/install-prompt";

/* ============================================================
 * A permanent way to install the app.
 *
 * The install card appears on its own, but politely: once per
 * session, never once installed. That is right for something
 * unprompted — and it left no route at all for someone who
 * closed it, or who went looking for it later. "Where do I get
 * the app?" had no answer on the page.
 *
 * This is that answer. It opens the same card and ignores the
 * suppression rules, because a person who clicks a button
 * labelled "Install app" has told us plainly what they want.
 *
 * Hides itself when the app is already running installed —
 * offering to install it there would be nonsense.
 * ============================================================ */

export function InstallAppButton({ className }: { className?: string }) {
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    /* Rendered only after mount: it depends on how the page is being
       displayed, which the server cannot know without guessing wrong. */
    const installed =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    setShow(!installed);
  }, []);

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_INSTALL_EVENT))}
      className={
        className ??
        "flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-left transition-colors hover:bg-white/20"
      }
    >
      <Download className="h-5 w-5 shrink-0 text-gold" />
      <span className="flex flex-col leading-tight">
        <span className="text-[8px] uppercase tracking-wide text-white/70">
          Available now
        </span>
        <span className="text-xs font-semibold text-white">Install Rego</span>
      </span>
    </button>
  );
}
