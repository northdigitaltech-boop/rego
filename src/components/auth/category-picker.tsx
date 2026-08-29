"use client";

import * as React from "react";
import { Check } from "lucide-react";

import { PARTNER_CATEGORIES } from "@/lib/partner-categories";
import { cn } from "@/lib/utils";

/* ============================================================
 * "What do you offer?" — thirteen cards, one tap.
 *
 * WHY NOT THE DROPDOWN IT REPLACES
 *   A <select> shows one option at a time. Someone who is not
 *   sure whether they are a "Travel Company" or a "Tour Guide"
 *   cannot compare the two without scrolling back and forth,
 *   and on a phone the native picker covers the page while
 *   they do it. Thirteen cards fit on one screen in two
 *   columns, so the choice is made by looking rather than by
 *   remembering.
 *
 * WHY EACH CARD HAS A SENTENCE
 *   The names are Rego's words, not the provider's. Somebody
 *   who says "I have a guest house" does not necessarily read
 *   "Hotels & Resorts" as themselves. The line underneath
 *   names the neighbours so they recognise their own business
 *   in it.
 *
 * KEYBOARD AND SCREEN READERS
 *   Real radio inputs, visually hidden rather than replaced by
 *   divs with onClick. Arrow keys move between them and the
 *   group announces itself, both of which come free from the
 *   element and would have to be rebuilt otherwise.
 * ============================================================ */

export function CategoryPicker({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (slug: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <fieldset>
      <legend className="sr-only">What do you offer?</legend>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {PARTNER_CATEGORIES.map((c, i) => {
          const Icon = c.icon;
          const selected = value === c.slug;
          return (
            <label
              key={c.slug}
              className={cn(
                "relative flex cursor-pointer flex-col gap-1 rounded-2xl border-2 p-3 transition-colors",
                "focus-within:ring-2 focus-within:ring-forest-600/40",
                selected
                  ? "border-forest-600 bg-forest-50"
                  : "border-border bg-white hover:border-forest-600/40 hover:bg-muted/50"
              )}
            >
              <input
                type="radio"
                name="partner-category"
                value={c.slug}
                checked={selected}
                autoFocus={autoFocus && i === 0}
                onChange={() => onChange(c.slug)}
                className="sr-only"
              />

              {selected && (
                <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-forest-600 text-white">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}

              <Icon
                className={cn(
                  "h-6 w-6",
                  selected ? "text-forest-600" : "text-forest-600/70"
                )}
              />
              <span className="text-sm font-semibold leading-tight text-forest">
                {c.name}
              </span>
              {/* Hidden on the narrowest phones: at two columns the sentence
                  wraps to four lines and the grid becomes a wall of text,
                  which defeats the point of showing them all at once. */}
              <span className="hidden text-xs leading-snug text-muted-foreground sm:block">
                {c.description}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
