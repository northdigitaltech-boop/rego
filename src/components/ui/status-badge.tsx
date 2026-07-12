import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * StatusBadge — communicates live status (road conditions, availability, etc.)
 * using a limited, semantic color set that stays OUT of the Rego brand palette
 * so status never gets confused with brand accents.
 *
 *   open    → green   (Open / Available)
 *   caution → amber   (Caution / Limited)
 *   closed  → red     (Closed / Sold out)
 *   info    → blue    (Information / Seasonal)
 *   neutral → grey    (Unknown / Draft)
 */
export type StatusTone = "open" | "caution" | "closed" | "info" | "neutral";

const TONES: Record<StatusTone, string> = {
  open: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  caution: "bg-amber-50 text-amber-700 ring-amber-600/20",
  closed: "bg-red-50 text-red-700 ring-red-600/20",
  info: "bg-sky-50 text-sky-700 ring-sky-600/20",
  neutral: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

const DOT: Record<StatusTone, string> = {
  open: "bg-emerald-500",
  caution: "bg-amber-500",
  closed: "bg-red-500",
  info: "bg-sky-500",
  neutral: "bg-slate-400",
};

export function StatusBadge({
  tone = "neutral",
  children,
  icon,
  dot = true,
  className,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
  icon?: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        TONES[tone],
        className
      )}
    >
      {icon ? (
        <span className="grid place-items-center [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
      ) : dot ? (
        <span className={cn("h-1.5 w-1.5 rounded-full", DOT[tone])} />
      ) : null}
      {children}
    </span>
  );
}
