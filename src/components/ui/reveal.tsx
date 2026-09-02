"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/* ============================================================
 * Fade-and-rise as an element scrolls into view.
 *
 * WHY THIS IS NOT framer-motion ANY MORE
 *   Measured on the live homepage: 1,105 KB of JavaScript
 *   across 31 chunks, and 111 KB of it was framer-motion. What
 *   the whole site used it for was three things — this fade-in,
 *   a hover lift, and one mobile menu — and every one of them
 *   is a CSS transition. A hundred and eleven kilobytes is a
 *   second and a half on a 3G connection in Skardu, spent on
 *   an effect a stylesheet does for nothing.
 *
 * ONE OBSERVER, NOT ONE PER ELEMENT
 *   A homepage has dozens of these. Each creating its own
 *   IntersectionObserver would trade a library for a different
 *   kind of waste, so they share one, created on first use.
 *
 * RESPECTS prefers-reduced-motion
 *   Someone who has asked their system not to animate things
 *   gets the content immediately, not a slower version of the
 *   animation. framer-motion did this too; losing it would
 *   have been a regression dressed up as an optimisation.
 * ============================================================ */

type Cb = () => void;

let observer: IntersectionObserver | null = null;
const callbacks = new WeakMap<Element, Cb>();

function watch(el: Element, cb: Cb) {
  if (typeof IntersectionObserver === "undefined") {
    cb();
    return () => {};
  }
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          callbacks.get(e.target)?.();
          callbacks.delete(e.target);
          observer!.unobserve(e.target);
        }
      },
      /* Fires 60px before the element reaches the viewport, so the
         animation is finishing as it arrives rather than starting. This
         matches the margin the framer-motion version used. */
      { rootMargin: "0px 0px -60px 0px" }
    );
  }
  callbacks.set(el, cb);
  observer.observe(el);
  return () => {
    callbacks.delete(el);
    observer?.unobserve(el);
  };
}

interface RevealProps {
  /** Staggers siblings by 80ms each, as the previous version did. */
  index?: number;
  className?: string;
  children: React.ReactNode;
}

export function Reveal({ className, children, index = 0 }: RevealProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    /* Already on screen when the page loads — above the fold — so show it
       without waiting for a scroll that may never come. */
    if (el.getBoundingClientRect().top < window.innerHeight) {
      setShown(true);
      return;
    }
    return watch(el, () => setShown(true));
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "motion-safe:transition-[opacity,transform] motion-safe:duration-500 motion-safe:ease-out",
        shown
          ? "opacity-100 translate-y-0"
          : "motion-safe:opacity-0 motion-safe:translate-y-6",
        className
      )}
      style={shown ? { transitionDelay: `${index * 80}ms` } : undefined}
    >
      {children}
    </div>
  );
}
