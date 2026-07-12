"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

export interface FeatureItem {
  icon: LucideIcon;
  label: string;
  value?: string | number | null;
}

/**
 * Premium feature cards (icon · label · value). Items with no value are hidden,
 * so the grid only shows real data. Reusable across listing categories.
 */
export function FeatureCards({ items }: { items: FeatureItem[] }) {
  const shown = items.filter((it) => it.value !== undefined && it.value !== null && it.value !== "");
  if (shown.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {shown.map(({ icon: Icon, label, value }) => (
        <div
          key={label}
          className="flex flex-col items-start gap-2 rounded-2xl border border-border/70 bg-card p-4 shadow-premium"
        >
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-forest-50 text-forest-600">
            <Icon className="h-5 w-5" />
          </span>
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
          <span className="font-display text-sm font-bold text-forest">{value}</span>
        </div>
      ))}
    </div>
  );
}
