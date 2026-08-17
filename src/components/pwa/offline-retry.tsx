"use client";

import * as React from "react";
import { RefreshCw, Wifi } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Retry control for the offline page.
 *
 * Watches the browser's online event as well, so the moment signal
 * returns the button changes state — someone standing in a valley
 * waiting for a bar shouldn't have to keep tapping to find out.
 */
export function OfflineRetry() {
  const [online, setOnline] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const retry = () => {
    setBusy(true);
    // A plain reload: if the network is back the real page renders,
    // and if it isn't, this page comes straight back.
    window.location.reload();
  };

  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      <Button
        variant="gold"
        size="lg"
        onClick={retry}
        disabled={busy}
        className="rounded-lg"
      >
        <RefreshCw className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        {busy ? "Trying…" : "Try again"}
      </Button>

      {online && (
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-forest-600">
          <Wifi className="h-3.5 w-3.5" /> Your connection looks back — try again
        </p>
      )}
    </div>
  );
}
