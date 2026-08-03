"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowRight, Check } from "lucide-react";

import { type AdSlideRow } from "@/lib/ad-slides";
import { cn, photo } from "@/lib/utils";

/** Slide transition length — the smooth 0.5s cross-fade + slide. */
const TRANSITION_MS = 500;
/** How long each slide rests before advancing. */
const AUTOPLAY_MS = 5000;

/**
 * Sponsored promotion carousel.
 * Slides are admin-managed; autoplay pauses on hover, on touch, when the tab
 * is hidden, and for users who prefer reduced motion.
 */
export function PromoCarousel({ slides }: { slides: AdSlideRow[] }) {
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const count = slides.length;

  const go = React.useCallback(
    (next: number) => setIndex(((next % count) + count) % count),
    [count]
  );

  // Autoplay — skipped entirely when there's nothing to rotate.
  React.useEffect(() => {
    if (count < 2 || paused) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") setIndex((i) => (i + 1) % count);
    }, AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [count, paused]);

  // Swipe on touch devices.
  const startX = React.useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setPaused(true);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startX.current !== null) {
      const dx = e.changedTouches[0].clientX - startX.current;
      if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
    }
    startX.current = null;
    setPaused(false);
  };

  if (count === 0) return null;

  return (
    <section className="bg-background py-8 sm:py-10" aria-label="Sponsored promotions">
      <div className="container-px">
        <div
          className="group relative overflow-hidden rounded-3xl border border-border/70 shadow-premium"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          role="region"
          aria-roledescription="carousel"
        >
          {/* Track — one slide wide, translated smoothly. */}
          <div
            className="flex"
            style={{
              transform: `translateX(-${index * 100}%)`,
              transition: `transform ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
            }}
          >
            {slides.map((s, i) => (
              <Slide key={s.id} slide={s} active={i === index} />
            ))}
          </div>

          {/* Arrows (desktop, on hover) */}
          {count > 1 && (
            <>
              <Arrow side="left" onClick={() => go(index - 1)} />
              <Arrow side="right" onClick={() => go(index + 1)} />
            </>
          )}

          {/* Dots */}
          {count > 1 && (
            <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => go(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  aria-current={i === index}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    i === index ? "w-7 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Slide({ slide: s, active }: { slide: AdSlideRow; active: boolean }) {
  const badges = (s.badges ?? []).filter(Boolean);
  const hasCta = !!(s.cta_label && s.cta_href);

  const inner = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo(s.image, 1400)}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Readability wash from the left, where the copy sits. */}
      <div className="absolute inset-0 bg-gradient-to-r from-forest-900/85 via-forest-900/45 to-transparent" />

      {/* Copy — gently rises in when the slide becomes active. */}
      <div
        className={cn(
          "relative flex h-full max-w-xl flex-col justify-center gap-3 p-6 text-white transition-all duration-700 sm:p-10",
          active ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        )}
      >
        {s.eyebrow && (
          <span className="w-fit rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-gold backdrop-blur">
            {s.eyebrow}
          </span>
        )}

        <h3 className="font-display text-2xl font-bold leading-tight sm:text-4xl">{s.title}</h3>

        {s.subtitle && (
          <p className="max-w-md text-sm leading-relaxed text-white/85 sm:text-base">{s.subtitle}</p>
        )}

        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <span
                key={b}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-2.5 py-1 text-xs font-semibold backdrop-blur"
              >
                <Check className="h-3.5 w-3.5 text-gold" /> {b}
              </span>
            ))}
          </div>
        )}

        {hasCta && (
          <span className="mt-1 inline-flex w-fit items-center gap-2 rounded-xl bg-gradient-gold px-5 py-2.5 text-sm font-bold text-forest-900 shadow-gold-glow transition-transform group-hover:-translate-y-0.5">
            {s.cta_label} <ArrowRight className="h-4 w-4" />
          </span>
        )}

        {s.advertiser && (
          <span className="mt-1 text-[11px] text-white/60">Sponsored by {s.advertiser}</span>
        )}
      </div>
    </>
  );

  const className =
    "relative h-[260px] w-full shrink-0 overflow-hidden sm:h-[340px] lg:h-[380px]";

  // External advertiser links open in a new tab and are marked sponsored.
  if (hasCta && s.cta_external) {
    return (
      <a
        href={s.cta_href!}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className={className}
        tabIndex={active ? 0 : -1}
      >
        {inner}
      </a>
    );
  }
  if (hasCta) {
    return (
      <Link href={s.cta_href!} className={className} tabIndex={active ? 0 : -1}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

function Arrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      aria-label={side === "left" ? "Previous slide" : "Next slide"}
      className={cn(
        "absolute top-1/2 z-10 hidden -translate-y-1/2 place-items-center rounded-full bg-white/20 p-2 text-white backdrop-blur transition-all hover:bg-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:grid",
        "opacity-0 group-hover:opacity-100",
        side === "left" ? "left-4" : "right-4"
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
