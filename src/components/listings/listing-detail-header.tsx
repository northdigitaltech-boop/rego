"use client";

import * as React from "react";
import { Star, MapPin, ShieldCheck, Award, Share2, Heart, Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Premium detail-page header: large name, address, rating/reviews, verified +
 * ranking badges, and share/save actions. Reusable across all listing types.
 */
export function ListingDetailHeader({
  title,
  location,
  rating,
  reviews,
  verified,
  badge,
  saved,
  onToggleSave,
}: {
  title: string;
  location: string;
  rating?: number;
  reviews?: number;
  verified?: boolean;
  badge?: string;
  saved?: boolean;
  onToggleSave?: () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* user cancelled or unsupported */
    }
  };

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {/* Badges above the title on desktop; on mobile they move next to Save/Share */}
        <div className="hidden flex-wrap items-center gap-2 lg:flex">
          {badge && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-gold px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-forest-900 shadow-gold-glow">
              <Award className="h-3.5 w-3.5" /> {badge}
            </span>
          )}
          {verified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-forest-700">
              <ShieldCheck className="h-3.5 w-3.5" /> Verified
            </span>
          )}
        </div>

        <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-forest sm:text-4xl">
          {title}
        </h1>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {location && (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-4 w-4 text-forest-600" /> {location}
            </span>
          )}
          {typeof rating === "number" && (
            <span className="inline-flex items-center gap-1.5">
              <span className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={
                      i < Math.round(rating)
                        ? "h-4 w-4 fill-gold text-gold"
                        : "h-4 w-4 text-border"
                    }
                  />
                ))}
              </span>
              <span className="font-semibold text-forest">{rating.toFixed(1)}</span>
              {typeof reviews === "number" && (
                <span className="text-muted-foreground">({reviews} reviews)</span>
              )}
            </span>
          )}
        </div>
      </div>

      <div className="no-scrollbar flex w-full flex-nowrap items-center justify-start gap-1.5 overflow-x-auto sm:w-auto sm:justify-end lg:gap-2">
        {/* Badges — mobile only, left of the buttons, equal spacing */}
        {badge && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-transparent bg-gradient-gold px-2.5 py-1.5 text-xs font-semibold uppercase text-forest-900 shadow-gold-glow lg:hidden">
            <Award className="h-3.5 w-3.5" /> {badge}
          </span>
        )}
        {verified && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-forest-100 bg-forest-50 px-2.5 py-1.5 text-xs font-semibold uppercase text-forest-700 lg:hidden">
            <ShieldCheck className="h-3.5 w-3.5" /> Verified
          </span>
        )}

        {/* Save, then Share (Share last) */}
        {onToggleSave && (
          <button
            type="button"
            onClick={onToggleSave}
            aria-pressed={saved}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold uppercase transition-colors lg:gap-1.5 lg:rounded-xl lg:px-3.5 lg:py-2 lg:text-sm",
              saved
                ? "border-red-200 bg-red-50 text-red-600"
                : "border-border bg-card text-forest hover:border-forest/40"
            )}
          >
            <Heart className={cn("h-3.5 w-3.5 lg:h-4 lg:w-4", saved && "fill-red-500 text-red-500")} />
            {saved ? "Saved" : "Save"}
          </button>
        )}
        <button
          type="button"
          onClick={share}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold uppercase text-forest transition-colors hover:border-forest/40 lg:gap-1.5 lg:rounded-xl lg:px-3.5 lg:py-2 lg:text-sm"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-forest-600 lg:h-4 lg:w-4" /> : <Share2 className="h-3.5 w-3.5 lg:h-4 lg:w-4" />}
          {copied ? "Copied" : "Share"}
        </button>
      </div>
    </div>
  );
}
