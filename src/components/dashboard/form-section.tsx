"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/* ============================================================
 * A group of form fields that can be folded away.
 *
 * WHY THE LISTING FORMS NEEDED THIS
 *   The transport form asks about sixty-six things across two
 *   screens, and exactly two of them are required. So the
 *   fields were never the obstacle — the sight of them was.
 *   Someone who opens that page cannot tell that they could
 *   fill in four boxes and be done, because nothing on screen
 *   says so.
 *
 *   This changes what is visible, not what is asked. No field
 *   is removed, renamed, or made newly optional. The essentials
 *   are open; the rest sits behind one line the provider can
 *   open when they have time.
 *
 * WHY IT IS NOT A WIZARD
 *   A wizard would hide the whole shape of the form and add
 *   navigation to get back to a field you half-filled. A
 *   provider editing their listing next month wants to find one
 *   price, not walk five screens. Folding keeps everything one
 *   scroll away.
 *
 * THE HEIGHT ANIMATION
 *   grid-template-rows 0fr → 1fr, rather than max-height with a
 *   guessed pixel value. A guess is either too small — which
 *   clips a long section — or too large, which makes short ones
 *   animate at the wrong speed.
 * ============================================================ */

export function FormSection({
  title,
  subtitle,
  /** Sections that must be filled in are open, and cannot be folded shut. */
  required,
  defaultOpen,
  /** Shown on the header, e.g. "3 of 8 filled in". */
  badge,
  children,
}: {
  title: string;
  subtitle?: string;
  required?: boolean;
  defaultOpen?: boolean;
  badge?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(required || defaultOpen || false);
  const id = React.useId();

  /* A required section is not collapsible at all — rendering a chevron that
     refuses to work is worse than rendering none. */
  if (required) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <header className="mb-4">
          <h3 className="font-display text-base font-bold text-forest">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </header>
        <div className="space-y-4">{children}</div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center gap-3 p-4 text-left sm:p-5"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-bold text-forest">
            {title}
          </span>
          {subtitle && (
            <span className="mt-0.5 block text-sm text-muted-foreground">
              {subtitle}
            </span>
          )}
        </span>

        {badge && (
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {badge}
          </span>
        )}

        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-forest-600 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      <div
        id={id}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        {/* overflow-hidden must be on the inner element: the grid row is what
            animates, and the content has to be clipped as it closes. */}
        <div className="overflow-hidden">
          {/* inert keeps a closed section out of the tab order, so tabbing
              through the form does not stop at fields nobody can see. */}
          <div className="space-y-4 px-4 pb-5 sm:px-5" inert={!open}>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * How many of a set of values have been filled in.
 *
 * For the badge on a folded section — "2 of 9" tells a provider whether it
 * is worth opening, which a chevron alone does not.
 */
export function filledCount(values: (string | number | null | undefined)[]) {
  const filled = values.filter(
    (v) => v !== null && v !== undefined && String(v).trim() !== ""
  ).length;
  return { filled, total: values.length, label: `${filled} of ${values.length}` };
}
