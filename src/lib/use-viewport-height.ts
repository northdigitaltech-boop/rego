"use client";

import * as React from "react";

/* ============================================================
 * Keyboard-aware viewport metrics.
 *
 * On iOS Safari the on-screen keyboard does two things that break a
 * `position: fixed` overlay:
 *   1. it shrinks the *visual* viewport while 100vh / 100dvh stay the same,
 *      so a full-height panel is taller than the space actually visible; and
 *   2. it SCROLLS the visual viewport, so anything pinned to the layout
 *      viewport slides off the top of the screen entirely.
 *
 * `window.visualViewport` reports both the visible height and how far it has
 * been shifted, so an overlay can be positioned against what the user can
 * really see.
 * ============================================================ */

export interface ViewportMetrics {
  /** Height of the area actually visible (excludes the keyboard). */
  height: number;
  /** How far the visual viewport has been scrolled down from the layout one. */
  offsetTop: number;
}

export function useViewportMetrics(active: boolean): ViewportMetrics | null {
  const [metrics, setMetrics] = React.useState<ViewportMetrics | null>(null);

  React.useEffect(() => {
    if (!active || typeof window === "undefined") {
      setMetrics(null);
      return;
    }

    const vv = window.visualViewport;
    const measure = () => {
      if (vv) {
        setMetrics({ height: vv.height, offsetTop: vv.offsetTop });
      } else {
        setMetrics({ height: window.innerHeight, offsetTop: 0 });
      }
    };

    measure();

    if (vv) {
      vv.addEventListener("resize", measure);
      vv.addEventListener("scroll", measure);
    }
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);

    return () => {
      if (vv) {
        vv.removeEventListener("resize", measure);
        vv.removeEventListener("scroll", measure);
      }
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [active]);

  return metrics;
}
