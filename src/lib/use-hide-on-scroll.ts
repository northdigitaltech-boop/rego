"use client";

import * as React from "react";

/**
 * True while the page is being scrolled DOWN — used to tuck the bottom
 * navigation and the floating buttons out of the way so they never sit on
 * top of a card's own actions while someone is browsing.
 *
 * Scrolling back up reveals them immediately, and they are always visible
 * near the top of the page.
 *
 * @param locked Pass true while a sheet/modal is open so the controls stay put.
 */
export function useHideOnScrollDown(locked = false): boolean {
  const [hidden, setHidden] = React.useState(false);
  const lastY = React.useRef(0);

  React.useEffect(() => {
    if (locked) {
      setHidden(false);
      return;
    }
    lastY.current = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY.current;
        // Ignore tiny jitter and iOS rubber-banding.
        if (Math.abs(delta) > 6) {
          // Always show near the very top of the page.
          setHidden(y > 80 && delta > 0);
          lastY.current = y;
        }
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [locked]);

  return hidden;
}
