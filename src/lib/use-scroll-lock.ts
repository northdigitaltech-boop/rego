"use client";

import * as React from "react";

/* ============================================================
 * Body scroll lock for modals, sheets and drawers.
 *
 * `overflow: hidden` alone is not enough:
 *  - iOS Safari ignores it and keeps scrolling the page behind the overlay;
 *  - restoring it afterwards loses the reader's place, so the page jumps.
 *
 * This pins the body with `position: fixed` at the current offset (which iOS
 * does honour) and puts the user back exactly where they were on release.
 * Nested overlays are reference-counted, so closing one doesn't unlock the
 * page while another is still open.
 * ============================================================ */

let locks = 0;
let savedY = 0;
let saved: { overflow: string; position: string; top: string; width: string; overscroll: string } | null = null;

function lock() {
  locks += 1;
  if (locks > 1) return; // already locked by an overlay further up

  const b = document.body;
  savedY = window.scrollY;
  saved = {
    overflow: b.style.overflow,
    position: b.style.position,
    top: b.style.top,
    width: b.style.width,
    overscroll: b.style.overscrollBehavior,
  };

  b.style.overflow = "hidden";
  b.style.position = "fixed";
  b.style.top = `-${savedY}px`;
  b.style.width = "100%";
  // Stop a scroll gesture inside the overlay chaining out to the page.
  b.style.overscrollBehavior = "contain";
}

function unlock() {
  locks = Math.max(0, locks - 1);
  if (locks > 0 || !saved) return; // another overlay still open

  const b = document.body;
  b.style.overflow = saved.overflow;
  b.style.position = saved.position;
  b.style.top = saved.top;
  b.style.width = saved.width;
  b.style.overscrollBehavior = saved.overscroll;
  saved = null;

  // Put the reader back where they were, without a smooth-scroll animation.
  const html = document.documentElement;
  const prevBehavior = html.style.scrollBehavior;
  html.style.scrollBehavior = "auto";
  window.scrollTo(0, savedY);
  html.style.scrollBehavior = prevBehavior;
}

/**
 * Locks page scrolling while `active` is true and restores the exact scroll
 * position when it becomes false (or the component unmounts).
 */
export function useScrollLock(active: boolean) {
  React.useEffect(() => {
    if (!active) return;
    lock();
    return unlock;
  }, [active]);
}
