"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { ListingCard } from "@/components/home/listing-card";
import { type Listing } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * Responsive, accessible horizontal card carousel (Booking.com-style behaviour,
 * Rego styling). Reuses <ListingCard> unchanged. Built on native CSS scroll-snap
 * so it supports touch swipe + trackpad scrolling for free, with React-driven
 * arrows and keyboard navigation on top.
 *
 * Visible cards per breakpoint: 1.1 (mobile) · 2 (tablet) · 3 (laptop) · 4 (xl).
 */
export function HotelCarousel({
  items,
  hidePrice = false,
  label = "Featured hotels",
}: {
  items: Listing[];
  hidePrice?: boolean;
  label?: string;
}) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = React.useState(true);
  const [atEnd, setAtEnd] = React.useState(false);

  const update = React.useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft >= max - 1);
  }, []);

  React.useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update, items.length]);

  // Scroll by exactly one card (card width + gap).
  const step = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>("[data-slide]");
    const gap = 16; // matches gap-4
    const amount = first ? first.offsetWidth + gap : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="relative">
      {/* Left arrow — hidden at the start */}
      <button
        type="button"
        onClick={() => step(-1)}
        aria-label="Previous hotels"
        tabIndex={atStart ? -1 : 0}
        className={cn(
          "absolute -left-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-border bg-card p-2.5 text-forest shadow-premium transition-all hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 sm:grid",
          atStart && "pointer-events-none opacity-0"
        )}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      {/* Right arrow — hidden/disabled at the end */}
      <button
        type="button"
        onClick={() => step(1)}
        aria-label="Next hotels"
        tabIndex={atEnd ? -1 : 0}
        className={cn(
          "absolute -right-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-border bg-card p-2.5 text-forest shadow-premium transition-all hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 sm:grid",
          atEnd && "pointer-events-none opacity-0"
        )}
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Scroll track */}
      <div
        ref={trackRef}
        role="region"
        aria-roledescription="carousel"
        aria-label={label}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="no-scrollbar flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto scroll-smooth pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600/40"
      >
        {items.map((l, i) => (
          <div
            key={l.id}
            data-slide
            className="flex w-full flex-none snap-start sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)] xl:w-[calc(25%-0.75rem)]"
          >
            <ListingCard listing={l} index={i} hidePrice={hidePrice} className="h-full w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
