"use client";

import * as React from "react";

/* ============================================================
 * Keyboard-aware viewport height.
 *
 * On iOS Safari the on-screen keyboard shrinks the *visual* viewport but
 * leaves the layout viewport (and 100vh / 100dvh) unchanged, so a full-height
 * panel keeps its original size: the header scrolls out of reach and the text
 * input hides behind the keyboard.
 *
 * `window.visualViewport` reports the genuinely visible area, so we track it
 * and expose it as a pixel height the panel can use directly.
 * ============================================================ */

export function useViewportHeight(active: boolean): number | null {
  const [height, setHeight] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!active || typeof window === "undefined") return;

    const vv = window.visualViewport;
    const measure = () => setHeight(vv ? vv.height : window.innerHeight);

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

  return height;
}
