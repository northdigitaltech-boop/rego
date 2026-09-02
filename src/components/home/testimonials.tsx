"use client";

import * as React from "react";
import Link from "next/link";
import { Star, ChevronRight } from "lucide-react";

import { getFeaturedReviews, type ReviewRow } from "@/lib/reviews";
import { photo } from "@/lib/utils";

/**
 * "What Travelers Say" — REAL reviews left by real customers.
 * There is no sample data: if nobody has reviewed yet, the section hides
 * itself rather than showing invented testimonials.
 */
export function Testimonials() {
  const [reviews, setReviews] = React.useState<ReviewRow[] | null>(null);

  React.useEffect(() => {
    let active = true;
    getFeaturedReviews(4).then((r) => {
      if (active) setReviews(r);
    });
    return () => {
      active = false;
    };
  }, []);

  // Loading, or no real reviews yet → render nothing.
  if (!reviews || reviews.length === 0) return null;

  return (
    <section className="bg-background py-12 sm:py-16">
      <div className="container-px">
        <div className="mb-6 flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-lg font-bold uppercase leading-tight text-forest sm:text-2xl lg:text-3xl">
            What Travelers Say
          </h2>
          <Link
            href="/listings"
            className="flex items-center gap-1 text-sm font-semibold text-forest-600 transition-colors hover:text-gold"
          >
            Explore listings <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {reviews.map((r) => {
            const name = r.customer_name?.trim() || "Rego traveller";
            const stars = Math.max(1, Math.min(5, Math.round(Number(r.rating) || 5)));
            return (
              <figure
                key={r.id}
                className="flex flex-col rounded-3xl border border-border/70 bg-card p-6 shadow-premium transition-shadow hover:shadow-premium-lg"
              >
                <div className="flex items-center gap-1">
                  {Array.from({ length: stars }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-gold text-gold" />
                  ))}
                </div>
                <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-forest/85">
                  {r.text}
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                  {r.customer_avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo(r.customer_avatar, 80)}
                      alt={`${name} — traveller review`}
                      loading="lazy"
                      decoding="async"
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-forest font-display text-sm font-bold text-gold">
                      {name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-forest">{name}</p>
                    <p className="text-xs text-muted-foreground">Verified traveller</p>
                  </div>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
