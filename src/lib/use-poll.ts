"use client";

import * as React from "react";

/**
 * Runs `fn` on an interval, but ONLY while the browser tab is visible.
 *
 * When the tab is hidden the timer is cleared so we make zero background
 * requests; when it becomes visible again `fn` runs immediately (to catch up)
 * and the interval resumes. The latest `fn` is always used via a ref, so
 * callers don't need to memoise it.
 */
export function usePoll(fn: () => void, intervalMs: number, enabled = true) {
  const saved = React.useRef(fn);
  saved.current = fn;

  React.useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer == null) timer = setInterval(() => saved.current(), intervalMs);
    };
    const stop = () => {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        saved.current();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs, enabled]);
}
