"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* Dependency-free premium charts (inline SVG / CSS). */

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "forest",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: "forest" | "gold" | "green" | "red" | "blue";
}) {
  const accents: Record<string, string> = {
    forest: "bg-forest-50 text-forest-600",
    gold: "bg-gold/15 text-gold-700",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
    blue: "bg-blue-50 text-blue-600",
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-premium">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn("grid h-8 w-8 place-items-center rounded-lg", accents[accent])}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-2 font-display text-2xl font-bold text-forest">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function LineChart({
  points,
  labels,
  height = 160,
  color = "#0d7a5f",
}: {
  points: number[];
  labels?: string[];
  height?: number;
  color?: string;
}) {
  const w = 640;
  const h = height;
  const pad = 24;
  if (points.length === 0) {
    return <Empty text="No data for this period" height={h} />;
  }
  const max = Math.max(1, ...points);
  const stepX = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = h - pad - (p / max) * (h - pad * 2);
    return [x, y] as const;
  });
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const area = `${path} L${coords[coords.length - 1][0]},${h - pad} L${coords[0][0]},${h - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id="lc-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#lc-fill)" />
      <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3} fill={color} />
      ))}
      {labels &&
        coords.map(([x], i) =>
          i % Math.ceil(points.length / 6) === 0 ? (
            <text key={`t${i}`} x={x} y={h - 6} fontSize="10" textAnchor="middle" fill="#94a3b8">
              {labels[i]}
            </text>
          ) : null
        )}
    </svg>
  );
}

export function BarRows({
  items,
  color = "bg-gradient-forest",
}: {
  items: { label: string; value: number }[];
  color?: string;
}) {
  if (items.length === 0) return <Empty text="No data yet" />;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-2.5">
      {items.map((it) => (
        <div key={it.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="truncate font-medium text-forest">{it.label}</span>
            <span className="text-muted-foreground">{it.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full", color)} style={{ width: `${(it.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Donut({
  segments,
  size = 150,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) return <Empty text="No data yet" />;
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {segments.map((s, i) => {
            const frac = s.value / total;
            const dash = frac * c;
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={16}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return el;
          })}
        </g>
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize="18" fontWeight="700" fill="#0F4C3A">
          {total}
        </text>
      </svg>
      <div className="space-y-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            <span className="capitalize text-forest">{s.label}</span>
            <span className="text-muted-foreground">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Empty({ text, height }: { text: string; height?: number }) {
  return (
    <div
      className="grid place-items-center rounded-xl border border-dashed border-border bg-muted/30 text-sm text-muted-foreground"
      style={{ height: height ?? 120 }}
    >
      {text}
    </div>
  );
}
