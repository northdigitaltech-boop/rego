"use client";

import * as React from "react";
import {
  TrendingUp,
  DollarSign,
  CalendarCheck,
  BedDouble,
  Download,
  Percent,
  Loader2,
} from "lucide-react";
import { type BookingRow } from "@/lib/bookings";
import { type BookingRoomRow } from "@/lib/hotels";
import { type HotelRow } from "@/lib/supabase";
import { cn, formatPrice } from "@/lib/utils";

type RangeKey = "30d" | "90d" | "ytd" | "all";

const RANGES: { id: RangeKey; label: string }[] = [
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "ytd", label: "This year" },
  { id: "all", label: "All time" },
];

function rangeStart(key: RangeKey): Date | null {
  const now = new Date();
  if (key === "30d") return new Date(now.getTime() - 30 * 864e5);
  if (key === "90d") return new Date(now.getTime() - 90 * 864e5);
  if (key === "ytd") return new Date(now.getFullYear(), 0, 1);
  return null;
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString("en-US", { month: "short", year: "2-digit" });
}

export function AnalyticsPanel({
  bookings,
  brooms,
  hotels,
  loading,
}: {
  bookings: BookingRow[];
  brooms: BookingRoomRow[];
  hotels: HotelRow[];
  loading: boolean;
}) {
  const [range, setRange] = React.useState<RangeKey>("90d");
  const [hotelId, setHotelId] = React.useState<string>("all");

  const filtered = React.useMemo(() => {
    const start = rangeStart(range);
    return bookings.filter((b) => {
      if (hotelId !== "all" && b.hotel_id !== hotelId) return false;
      if (start) {
        const created = new Date(b.created_at);
        if (created < start) return false;
      }
      return true;
    });
  }, [bookings, range, hotelId]);

  const broomsFiltered = React.useMemo(() => {
    const start = rangeStart(range);
    return brooms.filter((b) => {
      if (hotelId !== "all" && b.hotel_id !== hotelId) return false;
      if (start && b.created_at && new Date(b.created_at) < start) return false;
      return true;
    });
  }, [brooms, range, hotelId]);

  const accepted = filtered.filter((b) => b.status === "accepted");
  const totalRevenue = accepted.reduce((s, b) => s + (b.total_price || 0), 0);
  const totalBookings = filtered.length;
  const totalGuests = accepted.reduce((s, b) => s + (b.guests || 0), 0);
  const conversion =
    totalBookings > 0 ? Math.round((accepted.length / totalBookings) * 100) : 0;
  const avgValue =
    accepted.length > 0 ? Math.round(totalRevenue / accepted.length) : 0;

  // Revenue + bookings by month (last up to 12 buckets present in data)
  const byMonth = React.useMemo(() => {
    const map = new Map<string, { revenue: number; count: number }>();
    for (const b of filtered) {
      const k = monthKey(new Date(b.created_at));
      const cur = map.get(k) ?? { revenue: 0, count: 0 };
      cur.count += 1;
      if (b.status === "accepted") cur.revenue += b.total_price || 0;
      map.set(k, cur);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([k, v]) => ({ key: k, label: monthLabel(k), ...v }));
  }, [filtered]);

  // Popular room types from booking_rooms (units sold)
  const roomTypes = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const r of broomsFiltered.filter((x) => x.status !== "rejected")) {
      const name = r.room_name || "Room";
      map.set(name, (map.get(name) ?? 0) + (r.units || 0));
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, units]) => ({ name, units }));
  }, [broomsFiltered]);

  const statusBreak = React.useMemo(() => {
    const s = { accepted: 0, pending: 0, rejected: 0 };
    for (const b of filtered) {
      if (b.status === "accepted") s.accepted += 1;
      else if (b.status === "rejected") s.rejected += 1;
      else s.pending += 1;
    }
    return s;
  }, [filtered]);

  const exportCsv = () => {
    const head = [
      "Reference",
      "Hotel",
      "Room",
      "Customer",
      "Email",
      "Check-in",
      "Check-out",
      "Guests",
      "Rooms",
      "Status",
      "Total",
      "Created",
    ];
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = filtered.map((b) =>
      [
        "SGB-" + b.id.replace(/-/g, "").slice(0, 8).toUpperCase(),
        b.hotel_title,
        b.room_name ?? "",
        b.customer_name ?? "",
        b.customer_email,
        b.check_in ?? "",
        b.check_out ?? "",
        b.guests,
        b.rooms,
        b.status,
        b.total_price,
        new Date(b.created_at).toISOString().slice(0, 10),
      ]
        .map(esc)
        .join(",")
    );
    const csv = [head.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rego-bookings-${range}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="grid place-items-center rounded-2xl border border-border bg-card py-20 text-muted-foreground shadow-soft">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const maxRev = Math.max(1, ...byMonth.map((m) => m.revenue));
  const maxCount = Math.max(1, ...byMonth.map((m) => m.count));
  const maxRoom = Math.max(1, ...roomTypes.map((r) => r.units));

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border bg-card p-1 shadow-soft">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition",
                  range === r.id
                    ? "bg-forest text-white"
                    : "text-muted-foreground hover:text-forest"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          {hotels.length > 1 && (
            <select
              value={hotelId}
              onChange={(e) => setHotelId(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-forest shadow-soft"
            >
              <option value="all">All hotels</option>
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.title}
                </option>
              ))}
            </select>
          )}
        </div>
        <Button onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi
          icon={DollarSign}
          label="Revenue (confirmed)"
          value={formatPrice(totalRevenue)}
          accent
        />
        <Kpi
          icon={CalendarCheck}
          label="Total bookings"
          value={totalBookings}
        />
        <Kpi icon={TrendingUp} label="Avg. booking value" value={formatPrice(avgValue)} />
        <Kpi icon={Percent} label="Acceptance rate" value={`${conversion}%`} />
        <Kpi icon={BedDouble} label="Rooms sold" value={broomsFiltered.filter((b) => b.status !== "rejected").reduce((s, b) => s + (b.units || 0), 0)} />
        <Kpi icon={CalendarCheck} label="Guests served" value={totalGuests} />
      </div>

      {/* Revenue trend */}
      <Card title="Revenue by month" subtitle="Confirmed bookings only">
        {byMonth.length === 0 ? (
          <Empty />
        ) : (
          <div className="flex items-end gap-3 overflow-x-auto pt-4">
            {byMonth.map((m) => (
              <div key={m.key} className="flex min-w-[44px] flex-1 flex-col items-center gap-2">
                <span className="text-xs font-semibold text-forest">
                  {m.revenue > 0 ? formatPrice(m.revenue) : ""}
                </span>
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-forest-600 to-forest-400 transition-all"
                  style={{ height: `${Math.max(4, (m.revenue / maxRev) * 160)}px` }}
                  title={`${m.label}: ${formatPrice(m.revenue)}`}
                />
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bookings volume */}
        <Card title="Booking volume by month">
          {byMonth.length === 0 ? (
            <Empty />
          ) : (
            <div className="flex items-end gap-3 overflow-x-auto pt-4">
              {byMonth.map((m) => (
                <div key={m.key} className="flex min-w-[40px] flex-1 flex-col items-center gap-2">
                  <span className="text-xs font-semibold text-forest">{m.count}</span>
                  <div
                    className="w-full rounded-t-md bg-gold transition-all"
                    style={{ height: `${Math.max(4, (m.count / maxCount) * 140)}px` }}
                    title={`${m.label}: ${m.count} bookings`}
                  />
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Popular room types */}
        <Card title="Popular room types" subtitle="By units booked">
          {roomTypes.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-3 pt-2">
              {roomTypes.map((r) => (
                <div key={r.name}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-forest">{r.name}</span>
                    <span className="text-muted-foreground">{r.units}</span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-forest-500"
                      style={{ width: `${(r.units / maxRoom) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Status breakdown */}
      <Card title="Booking status">
        <div className="grid grid-cols-3 gap-4 pt-2 text-center">
          <StatusStat label="Confirmed" value={statusBreak.accepted} color="text-emerald-600" />
          <StatusStat label="Pending" value={statusBreak.pending} color="text-amber-600" />
          <StatusStat label="Rejected" value={statusBreak.rejected} color="text-red-600" />
        </div>
      </Card>
    </div>
  );
}

function Button({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-forest-700 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <span
        className={cn(
          "grid h-10 w-10 place-items-center rounded-xl",
          accent ? "bg-gold/20 text-gold-700" : "bg-forest-50 text-forest-600"
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 font-display text-2xl font-bold text-forest">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-lg font-bold text-forest">{title}</h3>
        {subtitle && (
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function StatusStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 py-4">
      <p className={cn("font-display text-3xl font-extrabold", color)}>{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function Empty() {
  return (
    <p className="py-8 text-center text-sm text-muted-foreground">
      No data for the selected period yet.
    </p>
  );
}
